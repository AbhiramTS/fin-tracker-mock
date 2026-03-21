// ─────────────────────────────────────────────────────────────────────────────
//  utils/recurring.ts
// ─────────────────────────────────────────────────────────────────────────────

import {
	format,
	addDays,
	addWeeks,
	addMonths,
	subMonths,
	addQuarters,
	addYears,
	startOfMonth,
	endOfMonth,
	parseISO,
	isWithinInterval,
} from 'date-fns';
import { generateAmortisation } from './amortisation';
import type { AppState, Frequency, PaymentOccurrence, PaymentOccurrenceKind } from '@/types';

// ── Frequency advancement ─────────────────────────────────────────────────────

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
	};

	// Recurring payments
	(state.recurringPayments ?? [])
		.filter((r) => r.isActive)
		.forEach((r) =>
			projectDatesInMonth(r.nextDate, r.frequency, interval).forEach((d) =>
				add('recurring_payment', r.id, d, r.amount, r.name, r.category, r.accountId)
			)
		);

	// Recurring incomes
	(state.recurringIncomes ?? [])
		.filter((r) => r.isActive)
		.forEach((r) =>
			projectDatesInMonth(r.nextDate, r.frequency, interval).forEach((d) =>
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
					label: `${l.name} — EMI #${row.month}`,
					debitAccountHeadId: l.id,
					accountId: l.accountId,
					status: row.isPaid ? 'paid' : 'unpaid',
				}
			);
		});
	});

	// Credit card bills
	(state.accounts ?? [])
		.filter((a) => a.type === 'credit_card' && a.creditCard)
		.forEach((a) => {
			const cc = a.creditCard!;

			// A due date can land in this month from the previous or current statement month.
			const candidateStatements = [
				subMonths(new Date(year, month, cc.statementDay), 2),
				subMonths(new Date(year, month, cc.statementDay), 1),
				new Date(year, month, cc.statementDay),
				addMonths(new Date(year, month, cc.statementDay), 1),
			];

			candidateStatements.forEach((statementDate) => {
				const dueDate = addDays(statementDate, cc.gracePeriodDays ?? 20);
				if (!isWithinInterval(dueDate, interval)) return;

				const statementIso = format(statementDate, 'yyyy-MM-dd');
				const dueIso = format(dueDate, 'yyyy-MM-dd');
				const statementOutstanding = creditCardOutstandingOnDate(state, a.id, statementIso);

				add(
					'credit_card_bill',
					a.id,
					dueIso,
					statementOutstanding,
					`${a.name} bill`,
					'Credit Card',
					undefined,
					a.id
				);
			});
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
	interval: { start: Date; end: Date }
): string[] {
	const results = new Set<string>();

	// Walk forward from anchor
	let cur = parseISO(anchorDate);
	while (cur <= interval.end) {
		if (cur >= interval.start) results.add(format(cur, 'yyyy-MM-dd'));
		cur = parseISO(advanceByFrequency(format(cur, 'yyyy-MM-dd'), frequency));
	}

	// Walk backward from anchor to cover past months
	let back = stepBack(anchorDate, frequency);
	while (parseISO(back) >= interval.start) {
		if (parseISO(back) <= interval.end) results.add(back);
		back = stepBack(back, frequency);
	}

	return [...results].sort();
}

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
