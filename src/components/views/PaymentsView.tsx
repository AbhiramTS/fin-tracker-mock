import { useState, useMemo, useCallback, useEffect } from 'react';
import {
	CheckCircle2,
	Circle,
	SkipForward,
	ChevronLeft,
	ChevronRight,
	AlertTriangle,
	Wallet,
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
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { EmptyState } from '@/components/ui/empty-state';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/ui/form-field';
import type { PaymentOccurrence, Account, AccountHead, Loan } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
//  Pay Dialog
// ─────────────────────────────────────────────────────────────────────────────

interface PayDialogProps {
	occ: PaymentOccurrence | null;
	accounts: Account[];
	accountHeads: AccountHead[];
	loans: Loan[];
	computedBalances: Record<string, number>;
	onConfirm: (opts: {
		paidDate: string;
		paidAmount: number;
		creditAccountId: string;
		topUpAmount: number;
	}) => Promise<void>;
	onCancel: () => void;
}

function PayDialog({
	occ,
	accounts,
	accountHeads,
	loans,
	computedBalances,
	onConfirm,
	onCancel,
}: PayDialogProps) {
	const isIncome = occ?.kind === 'recurring_income';
	const isCreditCardBill = occ?.kind === 'credit_card_bill';

	const [paidDate, setPaidDate] = useState(todayStr());
	const [paidAmount, setPaidAmount] = useState('');
	const [creditAccountId, setCreditAccountId] = useState('');
	const [topUp, setTopUp] = useState(false);
	const [topUpAmount, setTopUpAmount] = useState('');
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!occ) return;
		const defaultAccount =
			occ.accountId ??
			(isIncome
				? accounts.find((a) => !['investment'].includes(a.type))?.id
				: isCreditCardBill
					? accounts.find((a) => ['bank', 'cash'].includes(a.type))?.id
					: accounts.find((a) => !['investment', 'loan'].includes(a.type))?.id) ??
			accounts[0]?.id ??
			'';
		setPaidDate(todayStr());
		setPaidAmount(String(occ.amount));
		setCreditAccountId(defaultAccount);
		setTopUp(false);
		setTopUpAmount('');
	}, [occ?.id, occ?.amount, occ?.accountId, accounts, isIncome, isCreditCardBill]);

	const amount = parseFloat(paidAmount) || 0;
	const account = accounts.find((a) => a.id === creditAccountId);
	const balance = computedBalances[creditAccountId] ?? account?.openingBalance ?? 0;
	const shortfall = !isIncome && amount > 0 && balance < amount;
	const shortfallAmt = shortfall ? amount - balance : 0;

	useEffect(() => {
		if (shortfall) setTopUpAmount(String(shortfallAmt));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shortfall, creditAccountId, paidAmount]);

	if (!occ) return null;

	const topUpAmt = parseFloat(topUpAmount) || shortfallAmt;
	const balanceAfter = isIncome
		? balance + amount
		: topUp
			? balance + topUpAmt - amount
			: balance - amount;

	const debitHead = accountHeads.find((h) => h.id === occ.debitAccountHeadId);
	const loan = occ.kind === 'loan_emi' ? loans.find((item) => item.id === occ.sourceId) : null;
	const loanProgress = loan ? Math.min((loan.paidMonths ?? 0) + 1, loan.tenureMonths) : null;

	const payableAccounts = isIncome
		? accounts.filter((a) => !['investment'].includes(a.type))
		: isCreditCardBill
			? accounts.filter((a) => ['bank', 'cash'].includes(a.type))
			: accounts.filter((a) => !['investment', 'loan'].includes(a.type));

	const handleConfirm = async () => {
		if (!creditAccountId || amount <= 0) return;
		setSaving(true);
		try {
			await onConfirm({
				paidDate,
				paidAmount: amount,
				creditAccountId,
				topUpAmount: topUp ? topUpAmt : 0,
			});
		} finally {
			setSaving(false);
		}
	};

	return (
		<Dialog
			open={!!occ}
			onOpenChange={(o) => !o && onCancel()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{isIncome ? 'Mark as Received' : 'Mark as Paid'}</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col gap-4 p-5 pt-2">
					<div className="rounded-lg bg-muted/50 p-3 text-sm">
						<p className="font-semibold truncate">{occ.label}</p>
						<p className="text-xs text-muted-foreground mt-0.5">
							Due {fmtDate(occ.dueDate)}
							{occ.category && ` · ${occ.category}`}
						</p>
						{loan && (
							<div className="mt-2 grid grid-cols-1 gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
								<p>
									<span className="font-medium text-foreground">Loan start:</span>{' '}
									{fmtDate(loan.startDate)}
								</p>
								<p>
									<span className="font-medium text-foreground">Progress:</span>{' '}
									EMI {loanProgress} of {loan.tenureMonths}
								</p>
							</div>
						)}
					</div>

					{/* Debit head — read-only, pre-set from recurring payment */}
					{debitHead && (
						<div className="flex items-center justify-between text-xs rounded-lg bg-muted/30 px-3 py-2">
							<span className="text-muted-foreground">Debit head (Dr)</span>
							<span className="font-semibold">{debitHead.name}</span>
						</div>
					)}

					<FormField label="Payment Date">
						<Input
							type="date"
							value={paidDate}
							onChange={(e) => setPaidDate(e.target.value)}
							max={todayStr()}
						/>
					</FormField>

					<FormField label={isIncome ? 'Amount Received (₹)' : 'Amount Paid (₹)'}>
						<Input
							type="number"
							min="0"
							step="0.01"
							value={paidAmount}
							onChange={(e) => {
								setPaidAmount(e.target.value);
								setTopUp(false);
							}}
							placeholder={String(occ.amount)}
						/>
						{amount !== occ.amount && amount > 0 && (
							<p className="text-[10px] text-muted-foreground mt-1">
								Expected: {fmt(occ.amount)} · {fmt(Math.abs(amount - occ.amount))}{' '}
								{amount > occ.amount ? 'over' : 'under'}
							</p>
						)}
					</FormField>

					<FormField
						label={isIncome ? 'Receive into account (Dr)' : 'Pay from account (Cr)'}>
						<Select
							value={creditAccountId}
							onValueChange={(v) => {
								setCreditAccountId(v);
								setTopUp(false);
							}}>
							<SelectTrigger>
								<SelectValue placeholder="Select account" />
							</SelectTrigger>
							<SelectContent>
								{payableAccounts.map((a) => (
									<SelectItem
										key={a.id}
										value={a.id}>
										<span className="flex items-center gap-2">
											<span
												className="inline-block h-2 w-2 rounded-full shrink-0"
												style={{
													background: a.color ?? 'hsl(191 100% 47%)',
												}}
											/>
											{a.name}
											<span
												className={`font-mono text-xs ml-auto ${(computedBalances[a.id] ?? 0) < 0 ? 'text-loss' : 'text-muted-foreground'}`}>
												{fmt(
													computedBalances[a.id] ?? a.openingBalance ?? 0
												)}
											</span>
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{account && amount > 0 && (
							<div className="mt-2 flex items-center justify-between text-xs rounded-lg bg-muted/40 px-3 py-2">
								<span className="text-muted-foreground flex items-center gap-1.5">
									<Wallet className="h-3 w-3" /> Balance after
								</span>
								<span
									className={`font-mono font-bold ${balanceAfter < 0 ? 'text-loss' : 'text-profit'}`}>
									{fmt(balanceAfter)}
								</span>
							</div>
						)}
					</FormField>

					{shortfall && (
						<div className="rounded-xl border border-warning/30 bg-warning/5 overflow-hidden">
							<div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
								<AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
								<p className="text-sm font-semibold text-warning">
									{account?.name} is short by {fmt(shortfallAmt)}
								</p>
							</div>
							<button
								type="button"
								onClick={() => setTopUp((v) => !v)}
								className="w-full flex items-start gap-3 px-3 pb-3 transition-colors text-left group">
								<div
									className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors ${topUp ? 'bg-profit border-profit' : 'border-border group-hover:border-profit/60'}`}>
									{topUp && (
										<svg
											className="h-2.5 w-2.5 text-white"
											viewBox="0 0 10 10"
											fill="none">
											<path
												d="M1.5 5L4 7.5L8.5 2.5"
												stroke="currentColor"
												strokeWidth="1.8"
												strokeLinecap="round"
												strokeLinejoin="round"
											/>
										</svg>
									)}
								</div>
								<p
									className="text-sm leading-relaxed flex-1 flex flex-wrap items-baseline gap-x-1 gap-y-0.5"
									onClick={(e) => e.stopPropagation()}>
									<span
										className={
											topUp ? 'text-foreground' : 'text-muted-foreground'
										}>
										Add
									</span>
									<span className="inline-flex items-baseline gap-0.5">
										<span
											className={`text-xs ${topUp ? 'text-profit' : 'text-muted-foreground'}`}>
											₹
										</span>
										<input
											type="number"
											min="0.01"
											step="0.01"
											value={topUpAmount}
											onClick={(e) => {
												e.stopPropagation();
												if (!topUp) setTopUp(true);
											}}
											onChange={(e) => {
												setTopUpAmount(e.target.value);
												if (!topUp) setTopUp(true);
											}}
											className={`w-24 bg-transparent border-b-2 outline-none font-mono text-sm font-semibold transition-colors px-0.5 ${topUp ? 'border-profit text-profit' : 'border-border text-muted-foreground focus:border-primary'}`}
										/>
									</span>
									<span
										className={
											topUp ? 'text-foreground' : 'text-muted-foreground'
										}>
										to
									</span>
									<span
										className={`font-semibold ${topUp ? 'text-foreground' : 'text-muted-foreground'}`}>
										{account?.name}
									</span>
									{topUp && topUpAmt > 0 && (
										<span className="text-xs text-muted-foreground">
											→ balance becomes {fmt(balance + topUpAmt)} before
											payment
										</span>
									)}
								</p>
							</button>
						</div>
					)}

					<div className="flex gap-2 pt-1">
						<Button
							variant="outline"
							className="flex-1"
							onClick={onCancel}
							disabled={saving}>
							Cancel
						</Button>
						<Button
							className="flex-1"
							variant={isIncome ? 'profit' : 'default'}
							onClick={handleConfirm}
							disabled={saving || amount <= 0 || !creditAccountId}>
							{saving
								? 'Saving…'
								: topUp
									? 'Top Up & Pay'
									: isIncome
										? 'Mark Received'
										: 'Confirm Payment'}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

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

// ── Month summary ─────────────────────────────────────────────────────────────
function MonthSummary({ occs }: { occs: PaymentOccurrence[] }) {
	const payments = occs.filter((o) => o.kind !== 'recurring_income');
	const incomes = occs.filter((o) => o.kind === 'recurring_income');
	const paid = payments.filter((o) => o.status === 'paid');
	const unpaid = payments.filter((o) => o.status === 'unpaid');
	const overdue = unpaid.filter((o) => o.dueDate < todayStr());

	return (
		<div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-xl overflow-hidden border border-border bg-border">
			{[
				{
					label: 'Total Out',
					value: fmt(payments.reduce((s, o) => s + o.amount, 0)),
					cls: 'text-foreground',
				},
				{
					label: 'Paid',
					value: fmt(paid.reduce((s, o) => s + (o.paidAmount ?? o.amount), 0)),
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
						: fmt(incomes.reduce((s, o) => s + (o.paidAmount ?? o.amount), 0)),
					cls: overdue.length ? 'text-loss' : 'text-profit',
				},
			].map(({ label, value, cls }) => (
				<div
					key={label}
					className="flex flex-col items-center py-3 bg-muted/20">
					<p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
						{label}
					</p>
					<p className={`font-mono text-xs font-bold mt-0.5 ${cls}`}>{value}</p>
				</div>
			))}
		</div>
	);
}

// ── Occurrence card ───────────────────────────────────────────────────────────
function OccurrenceCard({
	occ,
	accounts,
	loan,
	onMarkPaid,
	onMarkSkipped,
	onMarkUnpaid,
}: {
	occ: PaymentOccurrence;
	accounts: Account[];
	loan?: Loan;
	onMarkPaid: (o: PaymentOccurrence) => void;
	onMarkSkipped: (o: PaymentOccurrence) => void;
	onMarkUnpaid: (o: PaymentOccurrence) => void;
}) {
	const isIncome = occ.kind === 'recurring_income';
	const { bg, border, text } = urgencyClass(occ.dueDate, occ.status);
	const urgency =
		occ.status === 'unpaid'
			? urgencyLabel(occ.dueDate)
			: occ.status === 'paid'
				? `Paid ${fmtDate(occ.paidDate ?? occ.dueDate)}`
				: 'Skipped';
	const paidAcct = occ.status === 'paid' ? accounts.find((a) => a.id === occ.accountId) : null;
	const paymentAccount = occ.accountId ? accounts.find((a) => a.id === occ.accountId) : null;
	const loanMeta =
		loan && occ.kind === 'loan_emi'
			? [
					`Loan start ${fmtDate(loan.startDate)}`,
					`EMI ${Math.min((loan.paidMonths ?? 0) + (occ.status === 'paid' ? 0 : 1), loan.tenureMonths)} of ${loan.tenureMonths}`,
					paymentAccount ? `From ${paymentAccount.name}` : null,
				].filter(Boolean)
			: [];

	return (
		<div className={`rounded-xl border p-3.5 transition-all ${bg} ${border}`}>
			<div className="flex items-start gap-3">
				<div className="mt-0.5 shrink-0">
					{occ.status === 'paid' ? (
						<CheckCircle2 className="h-5 w-5 text-profit" />
					) : occ.status === 'skipped' ? (
						<SkipForward className="h-5 w-5 text-muted-foreground" />
					) : (
						<Circle className={`h-5 w-5 ${text}`} />
					)}
				</div>
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
								<span className={`text-[10px] font-semibold ${text}`}>
									{urgency}
								</span>
								<span className="text-[10px] text-muted-foreground">
									· {fmtDate(occ.dueDate)}
								</span>
							</div>
							{occ.status === 'paid' && paidAcct && (
								<div className="mt-1 text-[10px] text-muted-foreground flex items-center gap-1">
									<span
										className="inline-block h-1.5 w-1.5 rounded-full"
										style={{
											background: paidAcct.color ?? 'hsl(191 100% 47%)',
										}}
									/>
									{paidAcct.name}
									{occ.paidAmount !== undefined &&
										occ.paidAmount !== occ.amount && (
											<span className="text-warning ml-1">
												actual: {fmt(occ.paidAmount)}
											</span>
										)}
								</div>
							)}
							{loanMeta.length > 0 && (
								<div className="mt-2 flex flex-wrap gap-1.5">
									{loanMeta.map((item) => (
										<span
											key={item}
											className="rounded-md border border-border/70 bg-muted/35 px-2 py-1 text-[10px] font-medium text-muted-foreground">
											{item}
										</span>
									))}
								</div>
							)}
						</div>
						<div className="text-right shrink-0">
							<p
								className={`font-mono font-bold text-sm ${isIncome ? 'text-profit' : occ.status === 'paid' ? 'text-profit' : text}`}>
								{isIncome ? '+' : ''}
								{fmt(
									occ.status === 'paid' && occ.paidAmount !== undefined
										? occ.paidAmount
										: occ.amount
								)}
							</p>
						</div>
					</div>
					<div className="flex gap-1.5 mt-2.5">
						{occ.status !== 'paid' && (
							<button
								onClick={() => onMarkPaid(occ)}
								className="flex items-center gap-1 rounded-md bg-profit/15 border border-profit/30 px-2.5 py-1 text-[11px] font-semibold text-profit hover:bg-profit/25 transition-colors active:scale-95">
								<CheckCircle2 className="h-3 w-3" />
								{isIncome ? 'Mark Received' : 'Mark Paid'}
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
				</div>
			</div>
		</div>
	);
}

// ─────────────────────────────────────────────────────────────────────────────
//  Main view
// ─────────────────────────────────────────────────────────────────────────────
export function PaymentsView() {
	const { state, save, remove } = useApp();
	const today = new Date();
	const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
	const [payingOcc, setPayingOcc] = useState<PaymentOccurrence | null>(null);

	const year = viewDate.getFullYear();
	const month = viewDate.getMonth();

	const allOccs = useMemo(
		() => getOccurrencesForMonth(state, year, month),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[state, year, month]
	);

	const storedIds = useMemo(
		() => new Set((state.paymentOccurrences ?? []).map((o) => o.id)),
		[state.paymentOccurrences]
	);
	const loanById = useMemo(
		() => new Map((state.loans ?? []).map((loan) => [loan.id, loan])),
		[state.loans]
	);

	useEffect(() => {
		allOccs
			.filter((o) => !storedIds.has(o.id) && o.status !== 'paid')
			.forEach((o) => {
				save('paymentOccurrences', o as unknown as Record<string, unknown>).catch(() => {});
			});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [allOccs.length, year, month]);

	const todayStr_ = todayStr();
	const payments = allOccs.filter((o) => o.kind !== 'recurring_income');
	const incomes = allOccs.filter((o) => o.kind === 'recurring_income');
	const overdue = payments.filter((o) => o.status === 'unpaid' && o.dueDate < todayStr_);
	const upcoming = payments.filter((o) => o.status === 'unpaid' && o.dueDate >= todayStr_);
	const paid = payments.filter((o) => o.status === 'paid');
	const skipped = payments.filter((o) => o.status === 'skipped');

	// ── Confirm payment — creates a JournalEntry ────────────────────────────────
	const confirmPaid = useCallback(
		async (
			occ: PaymentOccurrence,
			opts: {
				paidDate: string;
				paidAmount: number;
				creditAccountId: string;
				topUpAmount: number;
			}
		) => {
			const { paidDate, paidAmount, creditAccountId, topUpAmount } = opts;
			const isIncome = occ.kind === 'recurring_income';
			const isLoanEmi = occ.kind === 'loan_emi';
			const isCreditCardBill = occ.kind === 'credit_card_bill';

			// 0. Top-up: income journal entry (debit the account, credit Equity/Adjustments)
			if (topUpAmount > 0) {
				await save('journalEntries', {
					description: `Top-up for ${occ.label}`,
					amount: topUpAmount,
					date: paidDate,
					type: 'income',
					debitAccountHeadId: creditAccountId, // asset account being credited (Dr)
					creditAccountHeadId: 'head_equity', // equity/adjustment (Cr)
					notes: `Top-up to cover ${occ.label}`,
				});
			}

			// 1. Main journal entry
			// Expense: Dr expense head, Cr asset account
			// Income:  Dr asset account, Cr income head
			const debitId = isIncome
				? creditAccountId
				: isCreditCardBill
					? (occ.sourceId ?? occ.debitAccountHeadId)
					: (occ.debitAccountHeadId ?? 'head_expense');
			const creditId = isIncome ? (occ.debitAccountHeadId ?? 'head_income') : creditAccountId;

			const entry = await save('journalEntries', {
				description: occ.label,
				amount: paidAmount,
				date: paidDate,
				type: isIncome
					? 'income'
					: isLoanEmi
						? 'emi'
						: isCreditCardBill
							? 'credit_card_payment'
							: 'expense',
				emiNumber: isLoanEmi ? occ.emiNumber : undefined,
				debitAccountHeadId: debitId,
				creditAccountHeadId: creditId,
				notes: `From payment: ${occ.label}`,
			});

			// 2. Mark occurrence paid
			await save('paymentOccurrences', {
				...occ,
				status: 'paid',
				paidDate,
				paidAmount,
				accountId: creditAccountId,
				transactionId: entry.id,
				updatedAt: new Date().toISOString(),
			} as unknown as Record<string, unknown>);

			// 3. Advance nextDate on recurring source
			if (occ.kind === 'recurring_payment') {
				const src = state.recurringPayments.find((r) => r.id === occ.sourceId);
				if (src && occ.dueDate >= src.nextDate)
					await save('recurringPayments', {
						...src,
						nextDate: advanceByFrequency(
							src.nextDate,
							src.frequency,
							src.monthScheduleRule
						),
					} as unknown as Record<string, unknown>);
			}
			if (occ.kind === 'recurring_income') {
				const src = state.recurringIncomes.find((r) => r.id === occ.sourceId);
				if (src && occ.dueDate >= src.nextDate)
					await save('recurringIncomes', {
						...src,
						nextDate: advanceByFrequency(src.nextDate, src.frequency),
					} as unknown as Record<string, unknown>);
			}

			// 4. Increment paidMonths for loan EMIs
			if (occ.kind === 'loan_emi') {
				const src = state.loans.find((l) => l.id === occ.sourceId);
				if (src)
					await save('loans', {
						...src,
						paidMonths: (src.paidMonths ?? 0) + 1,
					} as unknown as Record<string, unknown>);
			}

			setPayingOcc(null);
		},
		[state, save]
	);

	// ── Skip ───────────────────────────────────────────────────────────────────
	const markSkipped = useCallback(
		async (occ: PaymentOccurrence) => {
			await save('paymentOccurrences', {
				...occ,
				status: 'skipped',
				updatedAt: new Date().toISOString(),
			} as unknown as Record<string, unknown>);
			if (occ.kind === 'recurring_payment') {
				const src = state.recurringPayments.find((r) => r.id === occ.sourceId);
				if (src && occ.dueDate >= src.nextDate)
					await save('recurringPayments', {
						...src,
						nextDate: advanceByFrequency(
							src.nextDate,
							src.frequency,
							src.monthScheduleRule
						),
					} as unknown as Record<string, unknown>);
			}
			if (occ.kind === 'recurring_income') {
				const src = state.recurringIncomes.find((r) => r.id === occ.sourceId);
				if (src && occ.dueDate >= src.nextDate)
					await save('recurringIncomes', {
						...src,
						nextDate: advanceByFrequency(src.nextDate, src.frequency),
					} as unknown as Record<string, unknown>);
			}
		},
		[state, save]
	);

	// ── Undo ───────────────────────────────────────────────────────────────────
	const markUnpaid = useCallback(
		async (occ: PaymentOccurrence) => {
			if (occ.transactionId) {
				try {
					await remove('journalEntries', occ.transactionId);
				} catch {
					/* gone already */
				}
			}
			await save('paymentOccurrences', {
				...occ,
				status: 'unpaid',
				paidDate: undefined,
				paidAmount: undefined,
				transactionId: undefined,
				updatedAt: new Date().toISOString(),
			} as unknown as Record<string, unknown>);
		},
		[save, remove]
	);

	// ── Render ─────────────────────────────────────────────────────────────────
	const Section = ({
		title,
		count,
		total,
		children,
		titleCls = '',
	}: {
		title: string;
		count: number;
		total?: number;
		children: React.ReactNode;
		titleCls?: string;
	}) => (
		<section>
			<div className="flex items-center gap-2 mb-2">
				<p
					className={`text-xs font-bold uppercase tracking-wide ${titleCls || 'text-muted-foreground'}`}>
					{title} · {count}
				</p>
				{total !== undefined && (
					<span
						className={`font-mono text-xs font-bold ml-auto ${titleCls || 'text-muted-foreground'}`}>
						{fmt(total)}
					</span>
				)}
			</div>
			<div className="flex flex-col gap-2">{children}</div>
		</section>
	);

	const cardProps = (occ: PaymentOccurrence) => ({
		occ,
		accounts: state.accounts,
		loan: occ.kind === 'loan_emi' ? loanById.get(occ.sourceId) : undefined,
		onMarkPaid: () => setPayingOcc(occ),
		onMarkSkipped: () => markSkipped(occ),
		onMarkUnpaid: () => markUnpaid(occ),
	});

	return (
		<div className="flex flex-col gap-4">
			<div>
				<h2 className="font-display text-xl font-bold">Payments</h2>
				<p className="text-sm text-muted-foreground mt-0.5">
					Track what's due, paid, and upcoming
				</p>
			</div>

			<MonthNav
				date={viewDate}
				onPrev={() => setViewDate((d) => subMonths(d, 1))}
				onNext={() => setViewDate((d) => addMonths(d, 1))}
			/>

			{allOccs.length === 0 ? (
				<EmptyState
					icon="📅"
					title="No payments this month"
					description="Add recurring payments, loans, or credit cards to track due dates"
				/>
			) : (
				<>
					<MonthSummary occs={allOccs} />
					{overdue.length > 0 && (
						<Section
							title="Overdue"
							count={overdue.length}
							total={overdue.reduce((s, o) => s + o.amount, 0)}
							titleCls="text-loss">
							{overdue.map((o) => (
								<OccurrenceCard
									key={o.id}
									{...cardProps(o)}
								/>
							))}
						</Section>
					)}
					{upcoming.length > 0 && (
						<Section
							title="Upcoming"
							count={upcoming.length}
							total={upcoming.reduce((s, o) => s + o.amount, 0)}>
							{upcoming.map((o) => (
								<OccurrenceCard
									key={o.id}
									{...cardProps(o)}
								/>
							))}
						</Section>
					)}
					{paid.length > 0 && (
						<Section
							title="Paid"
							count={paid.length}
							total={paid.reduce((s, o) => s + (o.paidAmount ?? o.amount), 0)}>
							{paid.map((o) => (
								<OccurrenceCard
									key={o.id}
									{...cardProps(o)}
								/>
							))}
						</Section>
					)}
					{skipped.length > 0 && (
						<Section
							title="Skipped"
							count={skipped.length}>
							{skipped.map((o) => (
								<OccurrenceCard
									key={o.id}
									{...cardProps(o)}
								/>
							))}
						</Section>
					)}
					{incomes.length > 0 && (
						<>
							<Separator />
							<Section
								title="Expected Income"
								count={incomes.length}
								total={incomes.reduce((s, o) => s + (o.paidAmount ?? o.amount), 0)}>
								{incomes.map((o) => (
									<OccurrenceCard
										key={o.id}
										{...cardProps(o)}
									/>
								))}
							</Section>
						</>
					)}
				</>
			)}

			<PayDialog
				occ={payingOcc}
				accounts={state.accounts}
				accountHeads={state.accountHeads}
				loans={state.loans}
				computedBalances={state.computedBalances}
				onConfirm={(opts) => confirmPaid(payingOcc!, opts)}
				onCancel={() => setPayingOcc(null)}
			/>
		</div>
	);
}
