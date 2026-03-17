import { useState, useMemo } from 'react';
import {
	ArrowDownLeft,
	ArrowUpRight,
	ArrowLeftRight,
	RefreshCw,
	CreditCard,
	Landmark,
	Users,
	ChevronLeft,
	ChevronRight,
	Clock,
} from 'lucide-react';
import {
	startOfMonth,
	endOfMonth,
	isBefore,
	isAfter,
	parseISO,
	addMonths as dfAddMonths,
} from 'date-fns';
import { useApp } from '@/context/AppContext';
import { fmt, fmtDate } from '@/utils/format';
import { generateAmortisation, nextEMIDate } from '@/utils/amortisation';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import type { Account, Loan, CreditCard as CCType, AppState } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
//  Transaction row model
// ─────────────────────────────────────────────────────────────────────────────

type TxKind =
	| 'expense'
	| 'income'
	| 'transfer_out'
	| 'transfer_in'
	| 'emi_paid'
	| 'emi_upcoming'
	| 'cc_charge'
	| 'cc_emi'
	| 'cc_due'
	| 'receivable_out'
	| 'repayment_in'
	| 'recurring_payment'
	| 'recurring_income';

interface TxRow {
	id: string;
	date: string; // yyyy-MM-dd
	label: string;
	sublabel?: string;
	amount: number; // positive = in, negative = out
	kind: TxKind;
	isPending: boolean; // future / upcoming
}

const KIND_META: Record<
	TxKind,
	{
		icon: React.ComponentType<{ className?: string }>;
		colorClass: string;
		label: string;
	}
> = {
	expense: { icon: ArrowUpRight, colorClass: 'text-loss', label: 'Expense' },
	income: { icon: ArrowDownLeft, colorClass: 'text-profit', label: 'Income' },
	transfer_out: { icon: ArrowLeftRight, colorClass: 'text-warning', label: 'Transfer Out' },
	transfer_in: { icon: ArrowLeftRight, colorClass: 'text-profit', label: 'Transfer In' },
	emi_paid: { icon: Landmark, colorClass: 'text-loss', label: 'EMI Paid' },
	emi_upcoming: { icon: Landmark, colorClass: 'text-warning', label: 'EMI Due' },
	cc_charge: { icon: CreditCard, colorClass: 'text-loss', label: 'CC Charge' },
	cc_emi: { icon: CreditCard, colorClass: 'text-loss', label: 'CC EMI' },
	cc_due: { icon: CreditCard, colorClass: 'text-warning', label: 'CC Bill Due' },
	receivable_out: { icon: Users, colorClass: 'text-warning', label: 'Money Lent' },
	repayment_in: { icon: Users, colorClass: 'text-profit', label: 'Repayment' },
	recurring_payment: { icon: RefreshCw, colorClass: 'text-loss', label: 'Recurring' },
	recurring_income: { icon: ArrowDownLeft, colorClass: 'text-profit', label: 'Recurring' },
};

// ─────────────────────────────────────────────────────────────────────────────
//  Data hooks — build ALL rows (past + future) for each entity type.
//  Filtering to a specific month is done in the UI layer.
// ─────────────────────────────────────────────────────────────────────────────

function useAccountRows(accountId: string): TxRow[] {
	const { state } = useApp();
	const today = new Date();

	return useMemo(() => {
		if (!accountId) return [];
		const rows: TxRow[] = [];
		const isPending = (dateStr: string) => isAfter(parseISO(dateStr), today);

		// Recorded expenses
		state.expenses
			.filter((e) => e.accountId === accountId)
			.forEach((e) =>
				rows.push({
					id: e.id,
					date: e.date,
					kind: 'expense',
					label: e.name,
					sublabel: e.category,
					amount: -(e.amount ?? 0),
					isPending: isPending(e.date),
				})
			);

		// Recorded incomes
		state.incomes
			.filter((i) => i.accountId === accountId)
			.forEach((i) =>
				rows.push({
					id: i.id,
					date: i.date,
					kind: 'income',
					label: i.name,
					sublabel: i.category ?? undefined,
					amount: i.amount ?? 0,
					isPending: isPending(i.date),
				})
			);

		// Transfers out
		state.transfers
			.filter((t) => t.fromAccountId === accountId)
			.forEach((t) => {
				const toName = state.accounts.find((a) => a.id === t.toAccountId)?.name ?? '?';
				rows.push({
					id: t.id,
					date: t.date,
					kind: 'transfer_out',
					label: `Transfer to ${toName}`,
					sublabel: t.notes ?? undefined,
					amount: -(t.amount ?? 0),
					isPending: isPending(t.date),
				});
			});

		// Transfers in
		state.transfers
			.filter((t) => t.toAccountId === accountId)
			.forEach((t) => {
				const fromName = state.accounts.find((a) => a.id === t.fromAccountId)?.name ?? '?';
				rows.push({
					id: t.id,
					date: t.date,
					kind: 'transfer_in',
					label: `Transfer from ${fromName}`,
					sublabel: t.notes ?? undefined,
					amount: t.amount ?? 0,
					isPending: isPending(t.date),
				});
			});

		// Loan EMIs debited from this account (all rows from amortisation — paid + future)
		state.loans
			.filter((l) => l.accountId === accountId)
			.forEach((l) => {
				generateAmortisation(l).forEach((r) => {
					const pending = !r.isPaid;
					rows.push({
						id: `${l.id}-emi-${r.month}`,
						date: r.date,
						kind: pending ? 'emi_upcoming' : 'emi_paid',
						label: `${l.name} — EMI #${r.month}`,
						sublabel: `Principal ${fmt(r.principal)} · Interest ${fmt(r.interest)}${r.tax ? ` · Tax ${fmt(r.tax)}` : ''}`,
						amount: -r.totalPayable,
						isPending: pending,
					});
				});
			});

		// Active recurring payments linked to this account — next due date as upcoming
		state.recurringPayments
			.filter((r) => r.isActive && r.accountId === accountId)
			.forEach((r) =>
				rows.push({
					id: `rp-${r.id}`,
					date: r.nextDate,
					kind: 'recurring_payment',
					label: r.name,
					sublabel: `${r.frequency} · ${r.category}`,
					amount: -(r.amount ?? 0),
					isPending: true,
				})
			);

		// Active recurring incomes linked to this account — next due date as upcoming
		state.recurringIncomes
			.filter((r) => r.isActive && r.accountId === accountId)
			.forEach((r) =>
				rows.push({
					id: `ri-${r.id}`,
					date: r.nextDate,
					kind: 'recurring_income',
					label: r.name,
					amount: r.amount ?? 0,
					isPending: true,
				})
			);

		// Money lent from this account
		state.receivables
			.filter((r) => r.accountId === accountId)
			.forEach((r) =>
				rows.push({
					id: r.id,
					date: r.dateLent,
					kind: 'receivable_out',
					label: `Lent to ${r.personName}`,
					sublabel: r.description ?? undefined,
					amount: -(r.amountLent ?? 0),
					isPending: isPending(r.dateLent),
				})
			);

		// Repayments received on receivables linked to this account
		state.repaymentRecords
			.filter(
				(rr) =>
					state.receivables.find((r) => r.id === rr.receivableId)?.accountId === accountId
			)
			.forEach((rr) => {
				const recv = state.receivables.find((r) => r.id === rr.receivableId);
				rows.push({
					id: rr.id,
					date: rr.date,
					kind: 'repayment_in',
					label: `Repayment from ${recv?.personName ?? '?'}`,
					sublabel: rr.notes ?? undefined,
					amount: rr.amount ?? 0,
					isPending: isPending(rr.date),
				});
			});

		return rows;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [accountId, state]);
}

function useCreditCardRows(cardId: string): TxRow[] {
	const { state } = useApp();
	const today = new Date();

	return useMemo(() => {
		if (!cardId) return [];
		const rows: TxRow[] = [];
		const isPending = (dateStr: string) => isAfter(parseISO(dateStr), today);
		const card = state.creditCards.find((c) => c.id === cardId);

		// Recorded expenses charged to card
		state.expenses
			.filter((e) => e.accountId === cardId)
			.forEach((e) =>
				rows.push({
					id: e.id,
					date: e.date,
					kind: 'cc_charge',
					label: e.name,
					sublabel: e.category,
					amount: -(e.amount ?? 0),
					isPending: isPending(e.date),
				})
			);

		// CC-linked loan EMIs (all — paid + upcoming)
		state.loans
			.filter((l) => l.loanType === 'credit_card' && l.linkedCreditCardId === cardId)
			.forEach((l) => {
				generateAmortisation(l).forEach((r) => {
					const pending = !r.isPaid;
					rows.push({
						id: `${l.id}-ccemi-${r.month}`,
						date: r.date,
						kind: pending ? 'emi_upcoming' : 'cc_emi',
						label: `${l.name} — EMI #${r.month}`,
						sublabel: `Principal ${fmt(r.principal)} · Interest ${fmt(r.interest)}${r.tax ? ` · Tax ${fmt(r.tax)}` : ''}`,
						amount: -r.totalPayable,
						isPending: pending,
					});
				});
			});

		// Credit card bill due date as upcoming
		if (card?.dueDate) {
			rows.push({
				id: `cc-due-${card.id}`,
				date: card.dueDate,
				kind: 'cc_due',
				label: `${card.name} bill due`,
				sublabel: `Outstanding: ${fmt(card.outstanding)}`,
				amount: -(card.outstanding ?? 0),
				isPending: isPending(card.dueDate),
			});
		}

		return rows;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cardId, state]);
}

function useLoanRows(loanId: string): TxRow[] {
	const { state } = useApp();

	return useMemo(() => {
		const loan = state.loans.find((l) => l.id === loanId);
		if (!loan) return [];

		return generateAmortisation(loan).map((r) => ({
			id: `${loanId}-emi-${r.month}`,
			date: r.date,
			kind: (r.isPaid ? 'emi_paid' : 'emi_upcoming') as TxKind,
			label: `EMI #${r.month}`,
			sublabel: `Principal ${fmt(r.principal)} · Interest ${fmt(r.interest)}${r.tax ? ` · Tax ${fmt(r.tax)}` : ''}`,
			amount: -r.totalPayable,
			isPending: !r.isPaid,
		}));
	}, [loanId, state]);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Month navigator
// ─────────────────────────────────────────────────────────────────────────────

interface MonthNavProps {
	year: number;
	month: number; // 0-based
	onPrev: () => void;
	onNext: () => void;
	canGoNext: boolean;
}

function MonthNav({ year, month, onPrev, onNext, canGoNext }: MonthNavProps) {
	const label = new Date(year, month, 1).toLocaleDateString('en-IN', {
		month: 'long',
		year: 'numeric',
	});
	return (
		<div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20 shrink-0">
			<Button
				size="icon-sm"
				variant="ghost"
				onClick={onPrev}>
				<ChevronLeft className="h-4 w-4" />
			</Button>
			<span className="font-semibold text-sm">{label}</span>
			<Button
				size="icon-sm"
				variant="ghost"
				onClick={onNext}
				disabled={!canGoNext}>
				<ChevronRight className="h-4 w-4" />
			</Button>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Month summary bar
// ─────────────────────────────────────────────────────────────────────────────

function MonthSummary({ past, upcoming }: { past: TxRow[]; upcoming: TxRow[] }) {
	const allRows = [...past, ...upcoming];
	const totalIn = allRows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
	const totalOut = allRows.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0);
	const net = totalIn + totalOut;
	const upcomingOut = upcoming.filter((r) => r.amount < 0).reduce((s, r) => s + r.amount, 0);

	return (
		<div className="grid grid-cols-4 gap-0 border-b border-border shrink-0">
			{[
				{ label: 'In', value: fmt(totalIn), cls: 'text-profit' },
				{ label: 'Out', value: fmt(Math.abs(totalOut)), cls: 'text-loss' },
				{ label: 'Net', value: fmt(net), cls: net >= 0 ? 'text-profit' : 'text-loss' },
				{ label: 'Upcoming', value: fmt(Math.abs(upcomingOut)), cls: 'text-warning' },
			].map(({ label, value, cls }) => (
				<div
					key={label}
					className="flex flex-col items-center py-2.5 border-r border-border last:border-0">
					<p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
						{label}
					</p>
					<p className={`font-mono text-xs font-bold mt-0.5 ${cls}`}>{value}</p>
				</div>
			))}
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Transaction row renderer
// ─────────────────────────────────────────────────────────────────────────────

function TxItem({ row }: { row: TxRow }) {
	const meta = KIND_META[row.kind];
	const Icon = meta.icon;
	const isIn = row.amount >= 0;

	return (
		<div
			className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40 ${row.isPending ? 'opacity-75' : ''}`}>
			<div
				className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${row.isPending ? 'bg-muted/40 border border-dashed border-border' : 'bg-muted/60'} ${meta.colorClass}`}>
				{row.isPending ? (
					<Clock className="h-3.5 w-3.5" />
				) : (
					<Icon className="h-3.5 w-3.5" />
				)}
			</div>
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium truncate">{row.label}</p>
				{row.sublabel && (
					<p className="text-xs text-muted-foreground truncate mt-0.5">{row.sublabel}</p>
				)}
				<p className="text-[10px] text-muted-foreground/60 mt-0.5">{fmtDate(row.date)}</p>
			</div>
			<div className="text-right shrink-0">
				<p
					className={`font-mono text-sm font-bold ${isIn ? 'text-profit' : row.isPending ? 'text-warning' : 'text-loss'}`}>
					{isIn ? '+' : ''}
					{fmt(row.amount)}
				</p>
				<Badge
					variant="muted"
					className="text-[9px] mt-0.5">
					{meta.label}
				</Badge>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Month ledger panel — core display logic
// ─────────────────────────────────────────────────────────────────────────────

function MonthLedger({ allRows, year, month }: { allRows: TxRow[]; year: number; month: number }) {
	const today = new Date();
	const monthStart = startOfMonth(new Date(year, month, 1));
	const monthEnd = endOfMonth(new Date(year, month, 1));
	const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
	const isFutureMonth = isAfter(monthStart, today);

	// All rows that fall in this month
	const monthRows = allRows.filter((r) => {
		const d = parseISO(r.date);
		return !isBefore(d, monthStart) && !isAfter(d, monthEnd);
	});

	// Split: recorded (past/today) vs upcoming (future)
	const past = monthRows
		.filter((r) => !isAfter(parseISO(r.date), today))
		.sort((a, b) => b.date.localeCompare(a.date));
	const upcoming = monthRows
		.filter((r) => isAfter(parseISO(r.date), today))
		.sort((a, b) => a.date.localeCompare(b.date));

	if (monthRows.length === 0) {
		return (
			<>
				<MonthSummary
					past={[]}
					upcoming={[]}
				/>
				<div className="flex-1 overflow-y-auto">
					<EmptyState
						icon={isFutureMonth ? '🔮' : '📋'}
						title={
							isFutureMonth
								? 'No scheduled transactions'
								: 'No transactions this month'
						}
						description={
							isFutureMonth
								? 'No recurring items or EMIs are due this month'
								: 'Nothing recorded for this period'
						}
					/>
				</div>
			</>
		);
	}

	return (
		<>
			<MonthSummary
				past={past}
				upcoming={upcoming}
			/>
			<div className="flex-1 overflow-y-auto px-1 py-1">
				{/* Upcoming section */}
				{upcoming.length > 0 && (
					<div className="mb-2">
						<div className="flex items-center gap-2 px-3 py-2">
							<Clock className="h-3.5 w-3.5 text-warning" />
							<span className="text-xs font-bold uppercase tracking-wide text-warning">
								Upcoming · {upcoming.length}
							</span>
							<span className="font-mono text-xs font-bold text-warning ml-auto">
								{fmt(
									upcoming
										.filter((r) => r.amount < 0)
										.reduce((s, r) => s + r.amount, 0)
								)}
							</span>
						</div>
						{upcoming.map((row) => (
							<TxItem
								key={row.id}
								row={row}
							/>
						))}
					</div>
				)}

				{/* Separator between sections when both exist */}
				{upcoming.length > 0 && past.length > 0 && <Separator className="my-2" />}

				{/* Recorded transactions */}
				{past.length > 0 && (
					<div>
						{(isCurrentMonth || isFutureMonth) && (
							<div className="flex items-center gap-2 px-3 py-2">
								<span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
									{isCurrentMonth ? 'Recorded' : 'Transactions'} · {past.length}
								</span>
								<span className="font-mono text-xs font-bold text-muted-foreground ml-auto">
									{(() => {
										const net = past.reduce((s, r) => s + r.amount, 0);
										return `${net >= 0 ? '+' : ''}${fmt(net)}`;
									})()}
								</span>
							</div>
						)}
						{past.map((row) => (
							<TxItem
								key={row.id}
								row={row}
							/>
						))}
					</div>
				)}

				{/* Pure future month — show all as upcoming */}
				{isFutureMonth && past.length === 0 && upcoming.length === 0 && null}
			</div>
		</>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Generic ledger dialog shell (holds month navigation state)
// ─────────────────────────────────────────────────────────────────────────────

interface LedgerShellProps {
	open: boolean;
	onClose: () => void;
	title: React.ReactNode;
	subtitle: React.ReactNode;
	allRows: TxRow[];
	totalCount: number;
}

function LedgerShell({ open, onClose, title, subtitle, allRows, totalCount }: LedgerShellProps) {
	const today = new Date();
	const [year, setYear] = useState(today.getFullYear());
	const [month, setMonth] = useState(today.getMonth());

	const goNext = () => {
		if (month === 11) {
			setMonth(0);
			setYear((y) => y + 1);
		} else setMonth((m) => m + 1);
	};
	const goPrev = () => {
		if (month === 0) {
			setMonth(11);
			setYear((y) => y - 1);
		} else setMonth((m) => m - 1);
	};

	// Allow navigating up to 12 months ahead
	const maxDate = dfAddMonths(today, 12);
	const canGoNext = isBefore(new Date(year, month + 1, 1), maxDate);

	// Reset to current month when dialog opens
	const handleOpenChange = (o: boolean) => {
		if (!o) {
			onClose();
			// Small delay so the month reset doesn't flash before close animation
			setTimeout(() => {
				setYear(today.getFullYear());
				setMonth(today.getMonth());
			}, 300);
		}
	};

	return (
		<Dialog
			open={open}
			onOpenChange={handleOpenChange}>
			<DialogContent className="flex flex-col max-h-[90dvh] p-0 gap-0">
				{/* Header */}
				<DialogHeader className="px-5 pt-5 pb-3 shrink-0">
					<DialogTitle className="text-base">{title}</DialogTitle>
					<p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
				</DialogHeader>

				{/* Month navigator */}
				<MonthNav
					year={year}
					month={month}
					onPrev={goPrev}
					onNext={goNext}
					canGoNext={canGoNext}
				/>

				{/* Month content */}
				<MonthLedger
					allRows={allRows}
					year={year}
					month={month}
				/>
			</DialogContent>
		</Dialog>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Public dialog exports
// ─────────────────────────────────────────────────────────────────────────────

export function AccountLedgerDialog({
	account,
	onClose,
}: {
	account: Account | null;
	onClose: () => void;
}) {
	const allRows = useAccountRows(account?.id ?? '');
	if (!account) return null;

	return (
		<LedgerShell
			open={!!account}
			onClose={onClose}
			title={
				<span className="flex items-center gap-2">
					<span
						className="inline-block h-3 w-3 rounded-full shrink-0"
						style={{ background: account.color ?? 'hsl(191 100% 47%)' }}
					/>
					{account.name}
					<Badge
						variant="muted"
						className="ml-1 text-[10px]">
						{account.type.replace('_', ' ')}
					</Badge>
				</span>
			}
			subtitle={
				<>
					Balance:{' '}
					<span className="font-mono font-bold text-cyan">{fmt(account.balance)}</span>
				</>
			}
			allRows={allRows}
			totalCount={allRows.length}
		/>
	);
}

export function LoanLedgerDialog({ loan, onClose }: { loan: Loan | null; onClose: () => void }) {
	const allRows = useLoanRows(loan?.id ?? '');
	if (!loan) return null;

	const paidRows = allRows.filter((r) => !r.isPending);

	return (
		<LedgerShell
			open={!!loan}
			onClose={onClose}
			title={
				<span className="flex items-center gap-2">
					<Landmark className="h-4 w-4 text-muted-foreground" />
					{loan.name}
					<Badge variant={loan.loanType === 'credit_card' ? 'warning' : 'muted'}>
						{loan.loanType === 'credit_card' ? 'CC Loan' : 'Normal'}
					</Badge>
				</span>
			}
			subtitle={
				<>
					{paidRows.length} EMIs paid · {Math.max(0, loan.tenureMonths - loan.paidMonths)}{' '}
					remaining
				</>
			}
			allRows={allRows}
			totalCount={allRows.length}
		/>
	);
}

export function CreditCardLedgerDialog({
	card,
	onClose,
}: {
	card: CCType | null;
	onClose: () => void;
}) {
	const allRows = useCreditCardRows(card?.id ?? '');
	if (!card) return null;

	return (
		<LedgerShell
			open={!!card}
			onClose={onClose}
			title={
				<span className="flex items-center gap-2">
					<CreditCard className="h-4 w-4 text-muted-foreground" />
					{card.name}
				</span>
			}
			subtitle={
				<>
					Outstanding:{' '}
					<span className="font-mono font-bold text-loss">{fmt(card.outstanding)}</span>
				</>
			}
			allRows={allRows}
			totalCount={allRows.length}
		/>
	);
}
