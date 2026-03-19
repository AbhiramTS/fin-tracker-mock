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
import type { PaymentOccurrence, Account } from '@/types';

// ─────────────────────────────────────────────────────────────────────────────
//  Pay Dialog — shown when user taps "Mark Paid"
// ─────────────────────────────────────────────────────────────────────────────

interface PayDialogProps {
	occ: PaymentOccurrence | null;
	accounts: Account[];
	onConfirm: (opts: {
		paidDate: string;
		paidAmount: number;
		accountId: string;
		topUpAmount: number;
	}) => Promise<void>;
	onCancel: () => void;
}

function PayDialog({ occ, accounts, onConfirm, onCancel }: PayDialogProps) {
	const isIncome = occ?.kind === 'recurring_income';

	const [paidDate, setPaidDate] = useState(todayStr());
	const [paidAmount, setPaidAmount] = useState('');
	const [accountId, setAccountId] = useState('');
	const [topUp, setTopUp] = useState(false);
	const [topUpAmount, setTopUpAmount] = useState(''); // editable inline amount
	const [saving, setSaving] = useState(false);

	// Reset fields whenever a new occurrence is opened
	useEffect(() => {
		if (!occ) return;
		setPaidDate(todayStr());
		setPaidAmount(String(occ.amount));
		setAccountId(occ.accountId ?? accounts[0]?.id ?? '');
		setTopUp(false);
		setTopUpAmount('');
	}, [occ?.id]);

	if (!occ) return null;

	const amount = parseFloat(paidAmount) || 0;
	const account = accounts.find((a) => a.id === accountId);
	const balance = account?.balance ?? 0;
	const shortfall = !isIncome && amount > 0 && balance < amount;
	const shortfallAmt = shortfall ? amount - balance : 0;
	const topUpAmt = parseFloat(topUpAmount) || shortfallAmt;

	// Balance after payment, incorporating optional top-up
	const balanceAfter = isIncome
		? balance + amount
		: topUp
			? balance + topUpAmt - amount
			: balance - amount;

	const payableAccounts = isIncome
		? accounts.filter((a) => !['investment'].includes(a.type))
		: accounts.filter((a) => !['investment', 'loan'].includes(a.type));

	// When shortfall appears, seed the top-up input with the exact shortfall
	useEffect(() => {
		if (shortfall) setTopUpAmount(String(shortfallAmt));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shortfall, accountId, paidAmount]);

	const handleConfirm = async () => {
		if (!accountId || amount <= 0) return;
		setSaving(true);
		try {
			await onConfirm({
				paidDate,
				paidAmount: amount,
				accountId,
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
					{/* Occurrence info */}
					<div className="rounded-lg bg-muted/50 p-3 text-sm">
						<p className="font-semibold truncate">{occ.label}</p>
						<p className="text-xs text-muted-foreground mt-0.5">
							Due {fmtDate(occ.dueDate)}
							{occ.category && ` · ${occ.category}`}
						</p>
					</div>

					{/* Payment date */}
					<FormField label="Payment Date">
						<Input
							type="date"
							value={paidDate}
							onChange={(e) => setPaidDate(e.target.value)}
							max={todayStr()}
						/>
					</FormField>

					{/* Actual amount */}
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

					{/* Account selector */}
					<FormField label={isIncome ? 'Credit Account' : 'Debit Account'}>
						<Select
							value={accountId}
							onValueChange={(v) => {
								setAccountId(v);
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
												className={`font-mono text-xs ml-auto ${a.balance < 0 ? 'text-loss' : 'text-muted-foreground'}`}>
												{fmt(a.balance)}
											</span>
										</span>
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						{/* Balance after payment */}
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

					{/* Shortfall — inline editable top-up */}
					{shortfall && (
						<div className="rounded-xl border border-warning/30 bg-warning/5 overflow-hidden">
							{/* Header */}
							<div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
								<AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
								<p className="text-sm font-semibold text-warning">
									{account?.name} is short by {fmt(shortfallAmt)}
								</p>
							</div>

							{/* Inline top-up toggle row */}
							<button
								type="button"
								onClick={() => setTopUp((v) => !v)}
								className={`w-full flex items-start gap-3 px-3 pb-3 transition-colors text-left group`}>
								{/* Checkbox */}
								<div
									className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors
                  ${topUp ? 'bg-profit border-profit' : 'border-border group-hover:border-profit/60'}`}>
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

								{/* Inline sentence with editable amount */}
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
											className={`w-24 bg-transparent border-b-2 outline-none font-mono text-sm font-semibold transition-colors px-0.5
                        ${
							topUp
								? 'border-profit text-profit focus:border-profit'
								: 'border-border text-muted-foreground focus:border-primary focus:text-foreground'
						}`}
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

					{/* Actions */}
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
							disabled={saving || amount <= 0 || !accountId}>
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

// ─────────────────────────────────────────────────────────────────────────────
//  Month navigator
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
//  Month summary strip
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
//  Single occurrence card
// ─────────────────────────────────────────────────────────────────────────────

function OccurrenceCard({
	occ,
	accounts,
	onMarkPaid,
	onMarkSkipped,
	onMarkUnpaid,
}: {
	occ: PaymentOccurrence;
	accounts: Account[];
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

	return (
		<div className={`rounded-xl border p-3.5 transition-all ${bg} ${border}`}>
			<div className="flex items-start gap-3">
				{/* Status icon */}
				<div className="mt-0.5 shrink-0">
					{occ.status === 'paid' ? (
						<CheckCircle2 className="h-5 w-5 text-profit" />
					) : occ.status === 'skipped' ? (
						<SkipForward className="h-5 w-5 text-muted-foreground" />
					) : (
						<Circle className={`h-5 w-5 ${text}`} />
					)}
				</div>

				{/* Body */}
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
							{/* Paid details */}
							{occ.status === 'paid' && (
								<div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
									{paidAcct && (
										<span className="flex items-center gap-1">
											<span
												className="inline-block h-1.5 w-1.5 rounded-full"
												style={{
													background:
														paidAcct.color ?? 'hsl(191 100% 47%)',
												}}
											/>
											{paidAcct.name}
										</span>
									)}
									{occ.paidAmount !== undefined &&
										occ.paidAmount !== occ.amount && (
											<span className="text-warning">
												actual: {fmt(occ.paidAmount)}
											</span>
										)}
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
							{occ.status === 'paid' &&
								occ.paidAmount !== undefined &&
								occ.paidAmount !== occ.amount && (
									<p className="text-[10px] text-muted-foreground line-through">
										{fmt(occ.amount)}
									</p>
								)}
						</div>
					</div>

					{/* Action buttons */}
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

	// Auto-save newly-generated occurrences (useEffect, not useMemo)
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

	const todayStr_ = todayStr();
	const payments = allOccs.filter((o) => o.kind !== 'recurring_income');
	const incomes = allOccs.filter((o) => o.kind === 'recurring_income');
	const overdue = payments.filter((o) => o.status === 'unpaid' && o.dueDate < todayStr_);
	const upcoming = payments.filter((o) => o.status === 'unpaid' && o.dueDate >= todayStr_);
	const paid = payments.filter((o) => o.status === 'paid');
	const skipped = payments.filter((o) => o.status === 'skipped');

	// ── Confirm payment ─────────────────────────────────────────────────────────
	const confirmPaid = useCallback(
		async (
			occ: PaymentOccurrence,
			opts: { paidDate: string; paidAmount: number; accountId: string; topUpAmount: number }
		) => {
			const { paidDate, paidAmount, accountId, topUpAmount } = opts;
			const isIncome = occ.kind === 'recurring_income';

			// 0. Top-up income if requested — save() auto-credits the account
			if (topUpAmount > 0) {
				await save('incomes', {
					name: `Top-up for ${occ.label}`,
					amount: topUpAmount,
					date: paidDate,
					accountId,
					category: 'Top-up',
					notes: `Top-up to cover ${occ.label} payment`,
				});
			}

			// 1. Create the transaction — save() auto-debits/credits the account
			let txId: string | undefined;
			if (!isIncome) {
				const expense = await save('expenses', {
					name: occ.label,
					amount: paidAmount,
					date: paidDate,
					category: occ.category ?? 'Bills',
					accountId,
					notes: `Auto-created from payment: ${occ.label}`,
				});
				txId = expense.id;
			} else {
				const income = await save('incomes', {
					name: occ.label,
					amount: paidAmount,
					date: paidDate,
					accountId,
					category: occ.category,
					notes: `Auto-created from payment: ${occ.label}`,
				});
				txId = income.id;
			}

			// 2. Mark occurrence paid with transaction reference
			const updated: PaymentOccurrence = {
				...occ,
				status: 'paid',
				paidDate,
				paidAmount,
				accountId, // record which account was actually used
				transactionId: txId,
				updatedAt: new Date().toISOString(),
			};
			await save('paymentOccurrences', updated as unknown as Record<string, unknown>);

			// 4. Advance nextDate on source recurring item
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

			// 5. For loan EMIs: increment paidMonths
			if (occ.kind === 'loan_emi') {
				const src = state.loans.find((l) => l.id === occ.sourceId);
				if (src) {
					await save('loans', {
						...src,
						paidMonths: (src.paidMonths ?? 0) + 1,
					} as unknown as Record<string, unknown>);
				}
			}

			setPayingOcc(null);
		},
		[state, save]
	);

	// ── Skip ─────────────────────────────────────────────────────────────────────
	const markSkipped = useCallback(
		async (occ: PaymentOccurrence) => {
			const updated: PaymentOccurrence = {
				...occ,
				status: 'skipped',
				updatedAt: new Date().toISOString(),
			};
			await save('paymentOccurrences', updated as unknown as Record<string, unknown>);

			if (occ.kind === 'recurring_payment') {
				const src = state.recurringPayments.find((r) => r.id === occ.sourceId);
				if (src && occ.dueDate >= src.nextDate)
					await save('recurringPayments', {
						...src,
						nextDate: advanceByFrequency(src.nextDate, src.frequency),
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

	// ── Undo ─────────────────────────────────────────────────────────────────────
	const markUnpaid = useCallback(
		async (occ: PaymentOccurrence) => {
			const isIncome = occ.kind === 'recurring_income';

			// Delete the linked transaction — remove() auto-restores the account balance
			if (occ.transactionId) {
				try {
					await remove(isIncome ? 'incomes' : 'expenses', occ.transactionId);
				} catch {
					// Transaction may already be gone — continue
				}
			}

			// Revert occurrence
			const updated: PaymentOccurrence = {
				...occ,
				status: 'unpaid',
				paidDate: undefined,
				paidAmount: undefined,
				transactionId: undefined,
				updatedAt: new Date().toISOString(),
			};
			await save('paymentOccurrences', updated as unknown as Record<string, unknown>);
		},
		[state, save, remove]
	);

	// ─────────────────────────────────────────────────────────────────────────────
	//  Render
	// ─────────────────────────────────────────────────────────────────────────────

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

			{/* Pay dialog */}
			<PayDialog
				occ={payingOcc}
				accounts={state.accounts}
				onConfirm={(opts) => confirmPaid(payingOcc!, opts)}
				onCancel={() => setPayingOcc(null)}
			/>
		</div>
	);
}
