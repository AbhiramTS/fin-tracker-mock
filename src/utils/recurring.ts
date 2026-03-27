// ─────────────────────────────────────────────────────────────────────────────
//  utils/recurring.ts
// ─────────────────────────────────────────────────────────────────────────────

import {
	format,
	addDays,
	addWeeks,
	addMonths,
	startOfMonth,
	endOfMonth,
	parseISO,
	isWithinInterval,
} from 'date-fns';
import { generateAmortisation } from './amortisation';
import type {
	AppState,
	Frequency,
	MonthScheduleRule,
	PaymentOccurrence,
	PaymentOccurrenceKind,
} from '@/types';

// ── Frequency advancement ─────────────────────────────────────────────────────

export function advanceByFrequency(
	dateStr: string,
	frequency: Frequency,
	monthScheduleRule: MonthScheduleRule = 'same_day'
): string {
	const d = parseISO(dateStr);
	switch (frequency) {
		case 'daily':
			return format(addDays(d, 1), 'yyyy-MM-dd');
		case 'weekly':
			return format(addWeeks(d, 1), 'yyyy-MM-dd');
		case 'fortnightly':
			return format(addWeeks(d, 2), 'yyyy-MM-dd');
		case 'monthly':
			return format(advanceMonthPattern(d, 1, monthScheduleRule), 'yyyy-MM-dd');
		case 'quarterly':
			return format(advanceMonthPattern(d, 3, monthScheduleRule), 'yyyy-MM-dd');
		case 'yearly':
			return format(advanceMonthPattern(d, 12, monthScheduleRule), 'yyyy-MM-dd');
	}
}

export function resolveMonthScheduleRule(
	dateStr: string,
	frequency: Frequency,
	monthScheduleRule?: MonthScheduleRule
): MonthScheduleRule {
	if (monthScheduleRule) return monthScheduleRule;
	if (!['monthly', 'quarterly', 'yearly'].includes(frequency)) return 'same_day';

	const anchor = parseISO(dateStr);
	if (Number.isNaN(anchor.getTime())) return 'same_day';

	return format(anchor, 'yyyy-MM-dd') === format(endOfMonth(anchor), 'yyyy-MM-dd')
		? 'last_day'
		: 'same_day';
}

function advanceMonthPattern(
	current: Date,
	months: number,
	monthScheduleRule: MonthScheduleRule
): Date {
	const target = addMonths(current, months);
	switch (monthScheduleRule) {
		case 'last_day':
			return endOfMonth(target);
		case 'last_working_day':
			return lastWorkingDayOfMonth(target);
		case 'same_day':
		default:
			return target;
	}
}

function lastWorkingDayOfMonth(dateInMonth: Date): Date {
	let d = endOfMonth(dateInMonth);
	while (d.getDay() === 0 || d.getDay() === 6) {
		d = addDays(d, -1);
	}
	return d;
}

// ── Deterministic occurrence id ───────────────────────────────────────────────
// Derived from sourceId + dueDate so it is identical across every render.
// This means markPaid always addresses the correct IDB record regardless of
// whether the auto-save has completed yet.
export function occurrenceId(sourceId: string, dueDate: string): string {
	return `occ_${sourceId}_${dueDate.replace(/-/g, '')}`;
}

// ── Generate occurrences for a calendar month ─────────────────────────────────

export function getOccurrencesForMonth(
	state: Partial<AppState>,
	year: number,
	month: number // 0-based (Jan = 0)
): PaymentOccurrence[] {
	const start = startOfMonth(new Date(year, month, 1));
	const end = endOfMonth(start);
	const interval = { start, end };
	const now_iso = new Date().toISOString();

	// Index stored occurrences by deterministic id for O(1) lookup
	const stored = new Map<string, PaymentOccurrence>();
	(state.paymentOccurrences ?? []).forEach((o) => stored.set(o.id, o));

	const result: PaymentOccurrence[] = [];
	const resultIds = new Set<string>();

	/** Produce one occurrence, reusing stored version if it exists */
	const add = (
		kind: PaymentOccurrenceKind,
		sourceId: string,
		dueDate: string,
		amount: number,
		label: string,
		category?: string,
		accountId?: string,
		debitAccountHeadId?: string
	) => {
		if (!isWithinInterval(parseISO(dueDate), interval)) return;
		const id = occurrenceId(sourceId, dueDate);
		const existing = stored.get(id);
		if (existing?.status === 'paid') {
			result.push(existing);
			resultIds.add(existing.id);
			return;
		}
		result.push(
			existing
				? {
						...existing,
						kind,
						sourceId,
						dueDate,
						amount,
						label,
						category,
						accountId: existing.accountId ?? accountId,
						debitAccountHeadId: existing.debitAccountHeadId ?? debitAccountHeadId,
						updatedAt: now_iso,
					}
				: {
						id,
						createdAt: now_iso,
						updatedAt: now_iso,
						kind,
						sourceId,
						dueDate,
						amount,
						label,
						category,
						accountId,
						debitAccountHeadId,
						status: 'unpaid',
					}
		);
		resultIds.add(id);
	};

	// Recurring payments
	(state.recurringPayments ?? [])
		.filter((r) => r.isActive)
		.forEach((r) =>
			projectDatesInMonth(r.nextDate, r.frequency, interval, r.monthScheduleRule).forEach(
				(d) => add('recurring_payment', r.id, d, r.amount, r.name, r.category, r.accountId)
			)
		);

	// Recurring incomes
	(state.recurringIncomes ?? [])
		.filter((r) => r.isActive)
		.forEach((r) =>
			projectDatesInMonth(
				r.nextDate,
				r.frequency,
				interval,
				resolveMonthScheduleRule(r.nextDate, r.frequency, r.monthScheduleRule)
			).forEach((d) =>
				add('recurring_income', r.id, d, r.amount, r.name, undefined, r.accountId)
			)
		);

	// Loan EMIs — use isPaid from amortisation as initial status
	(state.loans ?? []).forEach((l) => {
		generateAmortisation(l).forEach((row) => {
			if (!isWithinInterval(parseISO(row.date), interval)) return;
			const id = occurrenceId(l.id, row.date);
			result.push(
				stored.get(id) ?? {
					id,
					createdAt: now_iso,
					updatedAt: now_iso,
					kind: 'loan_emi',
					sourceId: l.id,
					dueDate: row.date,
					amount: row.totalPayable,
					emiNumber: row.month,
					label: `${l.name} — EMI #${row.month}`,
					debitAccountHeadId: l.id,
					accountId: l.accountId,
					status: row.isPaid ? 'paid' : 'unpaid',
				}
			);
		});
	});

	// Credit card bills
	// A card should contribute a single current obligation based on its tracked
	// outstanding + due date. Historical paid/skipped card bills remain visible
	// when navigating older months.
	(state.accounts ?? [])
		.filter((a) => a.type === 'credit_card' && a.creditCard)
		.forEach((a) => {
			const cc = a.creditCard!;

			const dueIso = cc.dueDate;
			const currentOutstanding = creditCardOutstandingOnDate(
				state,
				a.id,
				format(new Date(), 'yyyy-MM-dd')
			);

			if (dueIso && currentOutstanding > 0) {
				add(
					'credit_card_bill',
					a.id,
					dueIso,
					currentOutstanding,
					`${a.name} bill`,
					'Credit Card',
					undefined,
					a.id
				);
			}
		});

	(state.paymentOccurrences ?? []).forEach((occ) => {
		if (occ.kind !== 'credit_card_bill') return;
		if (occ.status === 'unpaid') return;
		if (!isWithinInterval(parseISO(occ.dueDate), interval)) return;
		if (resultIds.has(occ.id)) return;
		result.push(occ);
		resultIds.add(occ.id);
	});

	return result.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function creditCardOutstandingOnDate(
	state: Partial<AppState>,
	cardAccountId: string,
	asOfDate: string
): number {
	const account = (state.accounts ?? []).find((a) => a.id === cardAccountId);
	if (!account) return 0;

	let outstanding = Math.max(0, -(account.openingBalance ?? 0));
	if (outstanding === 0 && (account.creditCard?.outstanding ?? 0) > 0) {
		outstanding = account.creditCard!.outstanding;
	}

	(state.journalEntries ?? []).forEach((entry) => {
		if (entry.date > asOfDate) return;
		if (entry.creditAccountHeadId === cardAccountId) outstanding += entry.amount;
		if (entry.debitAccountHeadId === cardAccountId) outstanding -= entry.amount;
	});

	return Math.max(0, Math.round(outstanding * 100) / 100);
}

// ── Project recurring dates into a month ──────────────────────────────────────

function projectDatesInMonth(
	anchorDate: string,
	frequency: Frequency,
	interval: { start: Date; end: Date },
	monthScheduleRule: MonthScheduleRule = 'same_day'
): string[] {
	const results = new Set<string>();

	// Walk forward from anchor
	let cur = parseISO(anchorDate);
	while (cur <= interval.end) {
		if (cur >= interval.start) results.add(format(cur, 'yyyy-MM-dd'));
		cur = parseISO(advanceByFrequency(format(cur, 'yyyy-MM-dd'), frequency, monthScheduleRule));
	}

	// Walk backward from anchor to cover past months
	let back = stepBack(anchorDate, frequency, monthScheduleRule);
	while (parseISO(back) >= interval.start) {
		if (parseISO(back) <= interval.end) results.add(back);
		back = stepBack(back, frequency, monthScheduleRule);
	}

	return [...results].sort();
}

function stepBack(
	dateStr: string,
	frequency: Frequency,
	monthScheduleRule: MonthScheduleRule = 'same_day'
): string {
	const d = parseISO(dateStr);
	switch (frequency) {
		case 'daily':
			return format(addDays(d, -1), 'yyyy-MM-dd');
		case 'weekly':
			return format(addWeeks(d, -1), 'yyyy-MM-dd');
		case 'fortnightly':
			return format(addWeeks(d, -2), 'yyyy-MM-dd');
		case 'monthly':
			return format(advanceMonthPattern(d, -1, monthScheduleRule), 'yyyy-MM-dd');
		case 'quarterly':
			return format(advanceMonthPattern(d, -3, monthScheduleRule), 'yyyy-MM-dd');
		case 'yearly':
			return format(advanceMonthPattern(d, -12, monthScheduleRule), 'yyyy-MM-dd');
	}
}

// ── Urgency colour helper ─────────────────────────────────────────────────────

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
