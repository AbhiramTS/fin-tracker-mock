// ─────────────────────────────────────────────────────────────────────────────
//  utils/recurring.ts
//  Utilities for generating and managing PaymentOccurrences.
//
//  Model:
//    - Each RecurringPayment / RecurringIncome / Loan / CreditCard produces
//      PaymentOccurrence records — one per due-date in a calendar month.
//    - Occurrences are stored in IDB so the user can mark them paid/skipped.
//    - When generating for a month, we first check for an existing stored
//      occurrence (same sourceId + dueDate) and skip if found.
//    - On mark-paid, the nextDate of the source is advanced by its frequency.
// ─────────────────────────────────────────────────────────────────────────────

import {
	format,
	addDays,
	addWeeks,
	addMonths,
	addQuarters,
	addYears,
	startOfMonth,
	endOfMonth,
	parseISO,
	isWithinInterval,
} from 'date-fns';
import { generateAmortisation } from './amortisation';
import { generateId } from './id';
import { todayStr } from './format';
import type {
	AppState,
	Frequency,
	PaymentOccurrence,
	PaymentOccurrenceKind,
	RecurringPayment,
	RecurringIncome,
	Loan,
	CreditCard,
} from '@/types';

// ── Frequency advancement ─────────────────────────────────────────────────────

/** Given a date string and frequency, return the next occurrence date string. */
export function advanceByFrequency(dateStr: string, frequency: Frequency): string {
	const d = parseISO(dateStr);
	switch (frequency) {
		case 'daily':
			return format(addDays(d, 1), 'yyyy-MM-dd');
		case 'weekly':
			return format(addWeeks(d, 1), 'yyyy-MM-dd');
		case 'fortnightly':
			return format(addWeeks(d, 2), 'yyyy-MM-dd');
		case 'monthly':
			return format(addMonths(d, 1), 'yyyy-MM-dd');
		case 'quarterly':
			return format(addQuarters(d, 1), 'yyyy-MM-dd');
		case 'yearly':
			return format(addYears(d, 1), 'yyyy-MM-dd');
	}
}

// ── Occurrence builders ───────────────────────────────────────────────────────

function makeOccurrence(
	kind: PaymentOccurrenceKind,
	sourceId: string,
	dueDate: string,
	amount: number,
	label: string,
	category?: string,
	accountId?: string
): Omit<PaymentOccurrence, 'id' | 'createdAt' | 'updatedAt'> {
	return { kind, sourceId, dueDate, amount, label, category, accountId, status: 'unpaid' };
}

// ── Generate occurrences for a calendar month ─────────────────────────────────

/**
 * Returns the full list of PaymentOccurrences that should exist for the
 * given year/month, merging with any already stored in state.
 *
 * For occurrences not yet in state, returns new (unsaved) records so the
 * caller can save them. Stored occurrences (by sourceId + dueDate) are
 * returned as-is (preserving paid/skipped status).
 */
export function getOccurrencesForMonth(
	state: Partial<AppState>,
	year: number,
	month: number // 0-based
): PaymentOccurrence[] {
	const start = startOfMonth(new Date(year, month, 1));
	const end = endOfMonth(start);
	const interval = { start, end };
	const now = new Date();

	// Index existing stored occurrences by "sourceId|dueDate" for O(1) lookup
	const stored = new Map<string, PaymentOccurrence>();
	(state.paymentOccurrences ?? []).forEach((o) => {
		stored.set(`${o.sourceId}|${o.dueDate}`, o);
	});

	const result: PaymentOccurrence[] = [];

	const addOcc = (
		kind: PaymentOccurrenceKind,
		sourceId: string,
		dueDate: string,
		amount: number,
		label: string,
		category?: string,
		accountId?: string
	) => {
		if (!isWithinInterval(parseISO(dueDate), interval)) return;
		const key = `${sourceId}|${dueDate}`;
		if (stored.has(key)) {
			result.push(stored.get(key)!);
		} else {
			// New occurrence — mark as unpaid, assign a stable id
			const now_iso = new Date().toISOString();
			result.push({
				id: generateId(),
				createdAt: now_iso,
				updatedAt: now_iso,
				kind,
				sourceId,
				dueDate,
				amount,
				label,
				category,
				accountId,
				status: 'unpaid',
			});
		}
	};

	// ── Recurring payments ────────────────────────────────────────────────────
	// Walk from nextDate backwards to find all occurrences in the month.
	// We do this by projecting forward from the earliest possible date.
	(state.recurringPayments ?? [])
		.filter((r) => r.isActive)
		.forEach((r) => {
			projectDatesInMonth(r.nextDate, r.frequency, interval).forEach((d) =>
				addOcc('recurring_payment', r.id, d, r.amount, r.name, r.category, r.accountId)
			);
		});

	// ── Recurring incomes ─────────────────────────────────────────────────────
	(state.recurringIncomes ?? [])
		.filter((r) => r.isActive)
		.forEach((r) => {
			projectDatesInMonth(r.nextDate, r.frequency, interval).forEach((d) =>
				addOcc('recurring_income', r.id, d, r.amount, r.name, undefined, r.accountId)
			);
		});

	// ── Loan EMIs ─────────────────────────────────────────────────────────────
	(state.loans ?? []).forEach((l) => {
		generateAmortisation(l).forEach((row) => {
			if (isWithinInterval(parseISO(row.date), interval)) {
				const label = `${l.name} — EMI #${row.month}`;
				const key = `${l.id}|${row.date}`;
				if (stored.has(key)) {
					result.push(stored.get(key)!);
				} else {
					const now_iso = new Date().toISOString();
					result.push({
						id: generateId(),
						createdAt: now_iso,
						updatedAt: now_iso,
						kind: 'loan_emi',
						sourceId: l.id,
						dueDate: row.date,
						amount: row.totalPayable,
						label,
						accountId: l.accountId,
						// Pre-populate paid status from paidMonths
						status: row.isPaid ? 'paid' : 'unpaid',
					});
				}
			}
		});
	});

	// ── Credit card bills ─────────────────────────────────────────────────────
	(state.creditCards ?? []).forEach((cc) => {
		if (cc.dueDate && isWithinInterval(parseISO(cc.dueDate), interval)) {
			addOcc(
				'credit_card_bill',
				cc.id,
				cc.dueDate,
				cc.outstanding,
				`${cc.name} bill`,
				'Credit Card'
			);
		}
	});

	return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// ── Project dates in a month for a recurring item ────────────────────────────

/**
 * Given a known anchor date and frequency, find all occurrences within
 * the given interval. Works both forwards (future months) and backwards
 * (past months) from the anchor.
 */
function projectDatesInMonth(
	anchorDate: string,
	frequency: Frequency,
	interval: { start: Date; end: Date }
): string[] {
	const anchor = parseISO(anchorDate);
	const results: string[] = [];

	// Walk forward from anchor until past end of interval
	let cur = anchor;
	while (cur <= interval.end) {
		if (cur >= interval.start) results.push(format(cur, 'yyyy-MM-dd'));
		cur = parseISO(advanceByFrequency(format(cur, 'yyyy-MM-dd'), frequency));
	}

	// Also walk backward from anchor in case the interval is in the past
	cur = parseISO(
		advanceByFrequency(
			// Step back one frequency unit from anchor
			format(anchor, 'yyyy-MM-dd'),
			frequency
		)
	);
	// Actually step backward: find the period *before* the anchor
	// Do this by stepping back with inverse durations
	let back = stepBack(anchorDate, frequency);
	while (parseISO(back) >= interval.start) {
		if (parseISO(back) <= interval.end) results.push(back);
		back = stepBack(back, frequency);
	}

	return [...new Set(results)].sort();
}

/** Step backward one frequency unit */
function stepBack(dateStr: string, frequency: Frequency): string {
	const d = parseISO(dateStr);
	switch (frequency) {
		case 'daily':
			return format(addDays(d, -1), 'yyyy-MM-dd');
		case 'weekly':
			return format(addWeeks(d, -1), 'yyyy-MM-dd');
		case 'fortnightly':
			return format(addWeeks(d, -2), 'yyyy-MM-dd');
		case 'monthly':
			return format(addMonths(d, -1), 'yyyy-MM-dd');
		case 'quarterly':
			return format(addQuarters(d, -1), 'yyyy-MM-dd');
		case 'yearly':
			return format(addYears(d, -1), 'yyyy-MM-dd');
	}
}

// ── Urgency colour helper ─────────────────────────────────────────────────────

/**
 * Returns a Tailwind colour class for an unpaid occurrence based on
 * how many days remain until due date.
 *
 *  > 7 days  → yellow / warning
 *  3–7 days  → amber / orange
 *  0–2 days  → red
 *  overdue   → red (darker)
 */
export function urgencyClass(
	dueDate: string,
	status: string
): {
	bg: string;
	border: string;
	text: string;
	dot: string;
} {
	if (status === 'paid')
		return {
			bg: 'bg-profit/10',
			border: 'border-profit/30',
			text: 'text-profit',
			dot: 'bg-profit',
		};
	if (status === 'skipped')
		return {
			bg: 'bg-muted/40',
			border: 'border-border',
			text: 'text-muted-foreground',
			dot: 'bg-muted-foreground',
		};

	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const due = parseISO(dueDate);
	const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);

	if (days < 0)
		return { bg: 'bg-loss/15', border: 'border-loss/40', text: 'text-loss', dot: 'bg-loss' };
	if (days <= 2)
		return { bg: 'bg-loss/10', border: 'border-loss/30', text: 'text-loss', dot: 'bg-loss' };
	if (days <= 7)
		return {
			bg: 'bg-warning/10',
			border: 'border-warning/30',
			text: 'text-warning',
			dot: 'bg-warning',
		};
	return {
		bg: 'bg-warning/5',
		border: 'border-warning/20',
		text: 'text-warning',
		dot: 'bg-yellow-400',
	};
}

/** Human-readable urgency label */
export function urgencyLabel(dueDate: string): string {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const due = parseISO(dueDate);
	const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
	if (days < 0) return `Overdue by ${Math.abs(days)}d`;
	if (days === 0) return 'Due today';
	if (days === 1) return 'Due tomorrow';
	return `Due in ${days}d`;
}
