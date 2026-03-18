import { useState, useMemo, useCallback, useEffect } from 'react';
import {
	CheckCircle2,
	Circle,
	SkipForward,
	ChevronLeft,
	ChevronRight,
	AlertTriangle,
} from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { useApp } from '@/context/AppContext';
import { fmt, fmtDate, todayStr } from '@/utils/format';
import {
	advanceByFrequency,
	getOccurrencesForMonth,
	urgencyClass,
	urgencyLabel,
} from '@/utils/recurring';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
import type { PaymentOccurrence } from '@/types';

// ── Month navigator ───────────────────────────────────────────────────────────
function MonthNav({
	date,
	onPrev,
	onNext,
}: {
	date: Date;
	onPrev: () => void;
	onNext: () => void;
}) {
	const isCurrentMonth = format(date, 'yyyy-MM') === format(new Date(), 'yyyy-MM');
	return (
		<div className="flex items-center justify-between">
			<Button
				size="icon-sm"
				variant="ghost"
				onClick={onPrev}>
				<ChevronLeft className="h-4 w-4" />
			</Button>
			<div className="text-center">
				<p className="font-display font-bold text-base">{format(date, 'MMMM yyyy')}</p>
				{isCurrentMonth && (
					<p className="text-[10px] text-primary font-semibold uppercase tracking-wide">
						Current Month
					</p>
				)}
			</div>
			<Button
				size="icon-sm"
				variant="ghost"
				onClick={onNext}>
				<ChevronRight className="h-4 w-4" />
			</Button>
		</div>
	);
}

// ── Summary strip ─────────────────────────────────────────────────────────────
function MonthSummary({ occs }: { occs: PaymentOccurrence[] }) {
	const payments = occs.filter((o) => o.kind !== 'recurring_income');
	const incomes = occs.filter((o) => o.kind === 'recurring_income');
	const paid = payments.filter((o) => o.status === 'paid');
	const unpaid = payments.filter((o) => o.status === 'unpaid');
	const overdue = unpaid.filter((o) => o.dueDate < todayStr());

	return (
		<div className="grid grid-cols-4 gap-0 rounded-xl overflow-hidden border border-border">
			{[
				{
					label: 'Total Out',
					value: fmt(payments.reduce((s, o) => s + o.amount, 0)),
					cls: 'text-foreground',
				},
				{
					label: 'Paid',
					value: fmt(paid.reduce((s, o) => s + o.amount, 0)),
					cls: 'text-profit',
				},
				{
					label: 'Unpaid',
					value: fmt(unpaid.reduce((s, o) => s + o.amount, 0)),
					cls: 'text-warning',
				},
				{
					label: overdue.length ? 'Overdue' : 'Income',
					value: overdue.length
						? fmt(overdue.reduce((s, o) => s + o.amount, 0))
						: fmt(incomes.reduce((s, o) => s + o.amount, 0)),
					cls: overdue.length ? 'text-loss' : 'text-profit',
				},
			].map(({ label, value, cls }, i) => (
				<div
					key={label}
					className={`flex flex-col items-center py-3 bg-muted/20 ${i < 3 ? 'border-r border-border' : ''}`}>
					<p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
						{label}
					</p>
					<p className={`font-mono text-xs font-bold mt-0.5 ${cls}`}>{value}</p>
				</div>
			))}
		</div>
	);
}

// ── Single occurrence card ────────────────────────────────────────────────────
function OccurrenceCard({
	occ,
	onMarkPaid,
	onMarkSkipped,
	onMarkUnpaid,
}: {
	occ: PaymentOccurrence;
	onMarkPaid: (o: PaymentOccurrence) => void;
	onMarkSkipped: (o: PaymentOccurrence) => void;
	onMarkUnpaid: (o: PaymentOccurrence) => void;
}) {
	const isIncome = occ.kind === 'recurring_income';
	const { bg, border, text, dot } = urgencyClass(occ.dueDate, occ.status);
	const label =
		occ.status === 'unpaid'
			? urgencyLabel(occ.dueDate)
			: occ.status === 'paid'
				? `Paid ${fmtDate(occ.paidDate ?? occ.dueDate)}`
				: 'Skipped';

	return (
		<div className={`rounded-xl border p-3.5 transition-all ${bg} ${border}`}>
			<div className="flex items-start gap-3">
				{/* Status dot */}
				<div className="mt-0.5 shrink-0">
					{occ.status === 'paid' ? (
						<CheckCircle2 className="h-5 w-5 text-profit" />
					) : occ.status === 'skipped' ? (
						<SkipForward className="h-5 w-5 text-muted-foreground" />
					) : (
						<Circle className={`h-5 w-5 ${text}`} />
					)}
				</div>

				{/* Details */}
				<div className="flex-1 min-w-0">
					<div className="flex items-start justify-between gap-2">
						<div className="min-w-0">
							<p className="font-semibold text-sm truncate">{occ.label}</p>
							<div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
								{occ.category && (
									<Badge
										variant="muted"
										className="text-[9px]">
										{occ.category}
									</Badge>
								)}
								<span className={`text-[10px] font-semibold ${text}`}>{label}</span>
								<span className="text-[10px] text-muted-foreground">
									· {fmtDate(occ.dueDate)}
								</span>
							</div>
						</div>
						<p
							className={`font-mono font-bold text-sm shrink-0 ${isIncome ? 'text-profit' : occ.status === 'paid' ? 'text-profit' : text}`}>
							{isIncome ? '+' : ''}
							{fmt(occ.amount)}
						</p>
					</div>

					{/* Action buttons */}
					{!isIncome && (
						<div className="flex gap-1.5 mt-2.5">
							{occ.status !== 'paid' && (
								<button
									onClick={() => onMarkPaid(occ)}
									className="flex items-center gap-1 rounded-md bg-profit/15 border border-profit/30 px-2.5 py-1 text-[11px] font-semibold text-profit hover:bg-profit/25 transition-colors active:scale-95">
									<CheckCircle2 className="h-3 w-3" /> Mark Paid
								</button>
							)}
							{occ.status === 'unpaid' && (
								<button
									onClick={() => onMarkSkipped(occ)}
									className="flex items-center gap-1 rounded-md bg-muted/50 border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-colors active:scale-95">
									<SkipForward className="h-3 w-3" /> Skip
								</button>
							)}
							{occ.status !== 'unpaid' && (
								<button
									onClick={() => onMarkUnpaid(occ)}
									className="flex items-center gap-1 rounded-md bg-muted/50 border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-muted transition-colors active:scale-95">
									Undo
								</button>
							)}
						</div>
					)}
					{isIncome && occ.status !== 'paid' && (
						<div className="flex gap-1.5 mt-2.5">
							<button
								onClick={() => onMarkPaid(occ)}
								className="flex items-center gap-1 rounded-md bg-profit/15 border border-profit/30 px-2.5 py-1 text-[11px] font-semibold text-profit hover:bg-profit/25 transition-colors active:scale-95">
								<CheckCircle2 className="h-3 w-3" /> Mark Received
							</button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

// ── Main view ─────────────────────────────────────────────────────────────────
export function PaymentsView() {
	const { state, save } = useApp();
	const today = new Date();
	const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

	const year = viewDate.getFullYear();
	const month = viewDate.getMonth();

	// Get all occurrences for the current view month
	const allOccs = useMemo(
		() => getOccurrencesForMonth(state, year, month),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[state, year, month]
	);

	// Persist any newly-generated (unsaved) occurrences.
	// useEffect is correct here — this is a side effect, not a computation.
	// Because ids are deterministic, repeated saves are safe no-op upserts.
	const storedIds = useMemo(
		() => new Set((state.paymentOccurrences ?? []).map((o) => o.id)),
		[state.paymentOccurrences]
	);

	useEffect(() => {
		allOccs
			.filter((o) => !storedIds.has(o.id) && o.status !== 'paid')
			.forEach((o) => {
				save('paymentOccurrences', o as unknown as Record<string, unknown>).catch(() => {});
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [allOccs.length, year, month]);

	// Split into sections
	const todayStr_ = todayStr();
	const payments = allOccs.filter((o) => o.kind !== 'recurring_income');
	const incomes = allOccs.filter((o) => o.kind === 'recurring_income');

	const overdue = payments.filter((o) => o.status === 'unpaid' && o.dueDate < todayStr_);
	const upcoming = payments.filter((o) => o.status === 'unpaid' && o.dueDate >= todayStr_);
	const paid = payments.filter((o) => o.status === 'paid');
	const skipped = payments.filter((o) => o.status === 'skipped');

	// Handlers
	const markPaid = useCallback(
		async (occ: PaymentOccurrence) => {
			const updated: PaymentOccurrence = {
				...occ,
				status: 'paid',
				paidDate: todayStr(),
				updatedAt: new Date().toISOString(),
			};
			await save('paymentOccurrences', updated as unknown as Record<string, unknown>);

			// Advance nextDate on the source recurring item
			if (occ.kind === 'recurring_payment') {
				const src = state.recurringPayments.find((r) => r.id === occ.sourceId);
				if (src && occ.dueDate >= src.nextDate) {
					await save('recurringPayments', {
						...src,
						nextDate: advanceByFrequency(src.nextDate, src.frequency),
					} as unknown as Record<string, unknown>);
				}
			}
			if (occ.kind === 'recurring_income') {
				const src = state.recurringIncomes.find((r) => r.id === occ.sourceId);
				if (src && occ.dueDate >= src.nextDate) {
					await save('recurringIncomes', {
						...src,
						nextDate: advanceByFrequency(src.nextDate, src.frequency),
					} as unknown as Record<string, unknown>);
				}
			}
			// For loan EMIs, increment paidMonths on the loan
			if (occ.kind === 'loan_emi') {
				const src = state.loans.find((l) => l.id === occ.sourceId);
				if (src) {
					await save('loans', {
						...src,
						paidMonths: (src.paidMonths ?? 0) + 1,
					} as unknown as Record<string, unknown>);
				}
			}
		},
		[state, save]
	);

	const markSkipped = useCallback(
		async (occ: PaymentOccurrence) => {
			const updated: PaymentOccurrence = {
				...occ,
				status: 'skipped',
				updatedAt: new Date().toISOString(),
			};
			await save('paymentOccurrences', updated as unknown as Record<string, unknown>);
			// Advance nextDate so it doesn't stay stuck even when skipped
			if (occ.kind === 'recurring_payment') {
				const src = state.recurringPayments.find((r) => r.id === occ.sourceId);
				if (src && occ.dueDate >= src.nextDate) {
					await save('recurringPayments', {
						...src,
						nextDate: advanceByFrequency(src.nextDate, src.frequency),
					} as unknown as Record<string, unknown>);
				}
			}
			if (occ.kind === 'recurring_income') {
				const src = state.recurringIncomes.find((r) => r.id === occ.sourceId);
				if (src && occ.dueDate >= src.nextDate) {
					await save('recurringIncomes', {
						...src,
						nextDate: advanceByFrequency(src.nextDate, src.frequency),
					} as unknown as Record<string, unknown>);
				}
			}
		},
		[state, save]
	);

	const markUnpaid = useCallback(
		async (occ: PaymentOccurrence) => {
			const updated: PaymentOccurrence = {
				...occ,
				status: 'unpaid',
				paidDate: undefined,
				updatedAt: new Date().toISOString(),
			};
			await save('paymentOccurrences', updated as unknown as Record<string, unknown>);
		},
		[save]
	);

	const hasAny = allOccs.length > 0;

	return (
		<div className="flex flex-col gap-4">
			{/* Header */}
			<div>
				<h2 className="font-display text-xl font-bold">Payments</h2>
				<p className="text-sm text-muted-foreground mt-0.5">
					Track what's due, paid, and upcoming
				</p>
			</div>

			{/* Month navigator */}
			<MonthNav
				date={viewDate}
				onPrev={() => setViewDate((d) => subMonths(d, 1))}
				onNext={() => setViewDate((d) => addMonths(d, 1))}
			/>

			{/* Summary strip */}
			{hasAny && <MonthSummary occs={allOccs} />}

			{!hasAny && (
				<EmptyState
					icon="📅"
					title="No payments this month"
					description="Add recurring payments, loans, or credit cards to track due dates"
				/>
			)}

			{/* ── Overdue ── */}
			{overdue.length > 0 && (
				<section>
					<div className="flex items-center gap-2 mb-2">
						<AlertTriangle className="h-3.5 w-3.5 text-loss" />
						<p className="text-xs font-bold uppercase tracking-wide text-loss">
							Overdue · {overdue.length}
						</p>
						<span className="font-mono text-xs font-bold text-loss ml-auto">
							{fmt(overdue.reduce((s, o) => s + o.amount, 0))}
						</span>
					</div>
					<div className="flex flex-col gap-2">
						{overdue.map((o) => (
							<OccurrenceCard
								key={o.id}
								occ={o}
								onMarkPaid={markPaid}
								onMarkSkipped={markSkipped}
								onMarkUnpaid={markUnpaid}
							/>
						))}
					</div>
				</section>
			)}

			{/* ── Upcoming ── */}
			{upcoming.length > 0 && (
				<section>
					<div className="flex items-center gap-2 mb-2">
						<p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
							Upcoming · {upcoming.length}
						</p>
						<span className="font-mono text-xs font-bold text-warning ml-auto">
							{fmt(upcoming.reduce((s, o) => s + o.amount, 0))}
						</span>
					</div>
					<div className="flex flex-col gap-2">
						{upcoming.map((o) => (
							<OccurrenceCard
								key={o.id}
								occ={o}
								onMarkPaid={markPaid}
								onMarkSkipped={markSkipped}
								onMarkUnpaid={markUnpaid}
							/>
						))}
					</div>
				</section>
			)}

			{/* ── Paid ── */}
			{paid.length > 0 && (
				<section>
					<div className="flex items-center gap-2 mb-2">
						<p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
							Paid · {paid.length}
						</p>
						<span className="font-mono text-xs font-bold text-profit ml-auto">
							{fmt(paid.reduce((s, o) => s + o.amount, 0))}
						</span>
					</div>
					<div className="flex flex-col gap-2">
						{paid.map((o) => (
							<OccurrenceCard
								key={o.id}
								occ={o}
								onMarkPaid={markPaid}
								onMarkSkipped={markSkipped}
								onMarkUnpaid={markUnpaid}
							/>
						))}
					</div>
				</section>
			)}

			{/* ── Skipped ── */}
			{skipped.length > 0 && (
				<section>
					<div className="flex items-center gap-2 mb-2">
						<p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
							Skipped · {skipped.length}
						</p>
					</div>
					<div className="flex flex-col gap-2">
						{skipped.map((o) => (
							<OccurrenceCard
								key={o.id}
								occ={o}
								onMarkPaid={markPaid}
								onMarkSkipped={markSkipped}
								onMarkUnpaid={markUnpaid}
							/>
						))}
					</div>
				</section>
			)}

			{/* ── Expected income ── */}
			{incomes.length > 0 && (
				<>
					<Separator />
					<section>
						<div className="flex items-center gap-2 mb-2">
							<p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
								Expected Income · {incomes.length}
							</p>
							<span className="font-mono text-xs font-bold text-profit ml-auto">
								+{fmt(incomes.reduce((s, o) => s + o.amount, 0))}
							</span>
						</div>
						<div className="flex flex-col gap-2">
							{incomes.map((o) => (
								<OccurrenceCard
									key={o.id}
									occ={o}
									onMarkPaid={markPaid}
									onMarkSkipped={markSkipped}
									onMarkUnpaid={markUnpaid}
								/>
							))}
						</div>
					</section>
				</>
			)}
		</div>
	);
}
