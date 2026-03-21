import { useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { FormField, FormGrid, FormActions } from '@/components/ui/form-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { todayStr } from '@/utils/format';
import { calculateEMI, nextStatementDate, dueFromStatement } from '@/utils/amortisation';
import { useApp } from '@/context/AppContext';
import type {
	Account,
	AccountHead,
	JournalEntry,
	JournalEntryType,
	RecurringPayment,
	RecurringIncome,
	Loan,
	Receivable,
	RepaymentRecord,
	Investment,
	Reconciliation,
	Goal,
	Frequency,
	LoanType,
	InvestmentType,
	GoalType,
	AccountType,
} from '@/types';

// ── Constants ─────────────────────────────────────────────────────────────────
export const ACCOUNT_COLORS = [
	'#00d4f5',
	'#00e5a0',
	'#a78bfa',
	'#ffb020',
	'#ff3d5e',
	'#fb923c',
	'#06d6a0',
	'#e879f9',
];
export const EXPENSE_CATS = [
	'Food',
	'Transport',
	'Subscriptions',
	'Health',
	'Shopping',
	'Bills',
	'Entertainment',
	'Education',
	'Travel',
	'Other',
];
export const RECUR_CATS = [
	'Housing',
	'Subscriptions',
	'Investment',
	'Health',
	'Insurance',
	'Utilities',
	'Education',
	'Salary',
	'Other',
];
export const FREQS: Frequency[] = [
	'daily',
	'weekly',
	'fortnightly',
	'monthly',
	'quarterly',
	'yearly',
];
export const INV_TYPES: InvestmentType[] = [
	'stocks',
	'mutual_fund',
	'ppf',
	'fd',
	'nps',
	'crypto',
	'real_estate',
	'gold',
	'other',
];
export const GOAL_TYPES: GoalType[] = [
	'savings',
	'debt_payoff',
	'investment',
	'emergency_fund',
	'purchase',
	'custom',
];
export const GOAL_ICONS: Record<GoalType, string> = {
	savings: '💰',
	debt_payoff: '💸',
	investment: '📈',
	emergency_fund: '🛡️',
	purchase: '🛍️',
	custom: '🎯',
};

type FP<T> = { initialData?: Partial<T>; onSave: (d: Partial<T>) => void; onCancel: () => void };
type WithAccounts<T> = FP<T> & { accounts: Account[]; accountHeads?: AccountHead[] };

// ── Inline AccountHead creator ────────────────────────────────────────────────
// Shown as a small modal when user picks "+ Create new head" in a head selector.
function CreateHeadDialog({
	open,
	parentId,
	parentName,
	onCreated,
	onCancel,
}: {
	open: boolean;
	parentId: string;
	parentName: string;
	onCreated: (head: AccountHead) => void;
	onCancel: () => void;
}) {
	const { save, state } = useApp();
	const [name, setName] = useState('');
	const parent = state.accountHeads.find((h) => h.id === parentId);

	const handleCreate = async () => {
		if (!name.trim()) return;
		const now = new Date().toISOString();
		const saved = await save('accountHeads', {
			name: name.trim(),
			type: parent?.type ?? 'expense',
			parentId,
			isSystem: false,
			isAccount: false,
			createdAt: now,
			updatedAt: now,
		});
		setName('');
		onCreated(saved as unknown as AccountHead);
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => !o && onCancel()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>New account head under "{parentName}"</DialogTitle>
				</DialogHeader>
				<div className="flex flex-col gap-4 p-5 pt-2">
					<FormField label="Name">
						<Input
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder={`e.g. Netflix, Salary, Rent`}
							autoFocus
							onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
						/>
					</FormField>
					<div className="flex gap-2">
						<Button
							variant="outline"
							className="flex-1"
							onClick={onCancel}>
							Cancel
						</Button>
						<Button
							className="flex-1"
							onClick={handleCreate}
							disabled={!name.trim()}>
							Create
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

// ── AccountHead selector with inline create ───────────────────────────────────
// rootType: if set, only shows heads under that root (e.g. "expense" for expense entries)
// allowCreate: shows "+ Create new head" option

interface HeadSelectProps {
	heads: AccountHead[];
	value: string;
	onChange: (id: string) => void;
	placeholder?: string;
	rootType?: string;
	allowCreate?: boolean;
}

export function HeadSelect({
	heads,
	value,
	onChange,
	placeholder,
	rootType,
	allowCreate = true,
}: HeadSelectProps) {
	const [showCreate, setShowCreate] = useState(false);
	const [createParentId, setCreateParentId] = useState('');
	const [createParentName, setCreateParentName] = useState('');

	const roots = heads.filter((h) => h.parentId === null && (!rootType || h.type === rootType));
	const childrenOf = (pid: string) => heads.filter((h) => h.parentId === pid);

	const handleSelect = (v: string) => {
		if (v.startsWith('__create__')) {
			const parentId = v.replace('__create__', '');
			const parent = heads.find((h) => h.id === parentId);
			setCreateParentId(parentId);
			setCreateParentName(parent?.name ?? '');
			setShowCreate(true);
			return;
		}
		onChange(v);
	};

	return (
		<>
			<Select
				value={value}
				onValueChange={handleSelect}>
				<SelectTrigger>
					<SelectValue placeholder={placeholder ?? 'Select account head'} />
				</SelectTrigger>
				<SelectContent>
					{roots.map((root) => (
						<div key={root.id}>
							{/* Root label — selectable */}
							<SelectItem value={root.id}>
								<span className="font-semibold">{root.name}</span>
							</SelectItem>
							{/* Children */}
							{childrenOf(root.id).map((child) => (
								<SelectItem
									key={child.id}
									value={child.id}>
									<span className="pl-3 text-muted-foreground">
										└ {child.name}
									</span>
								</SelectItem>
							))}
							{/* Inline create option */}
							{allowCreate && (
								<SelectItem value={`__create__${root.id}`}>
									<span className="pl-3 text-primary flex items-center gap-1">
										<Plus className="h-3 w-3" /> New under {root.name}…
									</span>
								</SelectItem>
							)}
						</div>
					))}
				</SelectContent>
			</Select>

			<CreateHeadDialog
				open={showCreate}
				parentId={createParentId}
				parentName={createParentName}
				onCreated={(head) => {
					setShowCreate(false);
					onChange(head.id);
				}}
				onCancel={() => setShowCreate(false)}
			/>
		</>
	);
}

// ── AccountForm ───────────────────────────────────────────────────────────────
export function AccountForm({ initialData, onSave, onCancel }: FP<Account>) {
	const [f, setF] = useState<Partial<Account>>({
		name: '',
		type: 'bank',
		openingBalance: 0,
		color: ACCOUNT_COLORS[0],
		currency: 'INR',
		...initialData,
	});
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (f.name) onSave(f);
	};
	return (
		<form
			onSubmit={submit}
			className="flex flex-col gap-4 p-5 pt-2">
			<FormGrid>
				<FormField
					label="Account Name"
					span={2}>
					<Input
						value={f.name ?? ''}
						onChange={(e) => setF({ ...f, name: e.target.value })}
						placeholder="e.g. HDFC Savings"
						required
					/>
				</FormField>
				<FormField label="Type">
					<Select
						value={f.type ?? 'bank'}
						onValueChange={(v) => setF({ ...f, type: v as AccountType })}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{(
								[
									'bank',
									'cash',
									'credit_card',
									'loan',
									'investment',
									'receivable',
								] as AccountType[]
							).map((t) => (
								<SelectItem
									key={t}
									value={t}>
									{t.replace('_', ' ')}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
				<FormField
					label="Opening Balance (₹)"
					hint="Balance before any recorded transactions">
					<Input
						type="number"
						step="0.01"
						value={f.openingBalance ?? ''}
						onChange={(e) =>
							setF({ ...f, openingBalance: parseFloat(e.target.value) || 0 })
						}
					/>
				</FormField>
			</FormGrid>
			<div>
				<Label className="mb-2 block">Colour</Label>
				<div className="flex gap-2 flex-wrap">
					{ACCOUNT_COLORS.map((c) => (
						<button
							key={c}
							type="button"
							onClick={() => setF({ ...f, color: c })}
							className="h-7 w-7 rounded-full transition-transform hover:scale-110"
							style={{
								background: c,
								outline:
									f.color === c ? '3px solid white' : '3px solid transparent',
								outlineOffset: 2,
							}}
						/>
					))}
				</div>
			</div>
			<FormField label="Notes (optional)">
				<Textarea
					value={f.notes ?? ''}
					onChange={(e) => setF({ ...f, notes: e.target.value })}
					rows={2}
				/>
			</FormField>
			<FormActions onCancel={onCancel} />
		</form>
	);
}

// ── JournalEntryForm ──────────────────────────────────────────────────────────
// Handles all journal transaction types with type-aware debit/credit head filters.

interface JEFormProps {
	initialData?: Partial<JournalEntry>;
	onSave: (d: Partial<JournalEntry>) => void;
	onCancel: () => void;
	accounts: Account[];
	accountHeads: AccountHead[];
	defaultType?: JournalEntryType;
	allowTypeChange?: boolean;
	// If set, locks the debit or credit side (e.g. from PaymentsView)
	lockedDebitId?: string;
	lockedCreditId?: string;
}

export function JournalEntryForm({
	initialData,
	onSave,
	onCancel,
	accounts,
	accountHeads,
	defaultType = 'expense',
	allowTypeChange = false,
	lockedDebitId,
	lockedCreditId,
}: JEFormProps) {
	const [f, setF] = useState<Partial<JournalEntry>>({
		description: '',
		amount: undefined,
		date: todayStr(),
		type: (initialData?.type ?? defaultType) as JournalEntryType,
		debitAccountHeadId: lockedDebitId ?? '',
		creditAccountHeadId: lockedCreditId ?? '',
		...initialData,
	});
	const type = (f.type ?? defaultType) as JournalEntryType;

	const canSave = !!(f.description && f.amount && f.debitAccountHeadId && f.creditAccountHeadId);
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (canSave) onSave(f);
	};

	const TYPE_OPTIONS: { value: JournalEntryType; label: string }[] = [
		{ value: 'expense', label: 'Expense' },
		{ value: 'income', label: 'Income' },
		{ value: 'transfer', label: 'Transfer' },
		{ value: 'emi', label: 'EMI' },
		{ value: 'credit_card_payment', label: 'Credit Card Bill Payment' },
		{ value: 'loan_disbursal', label: 'Loan Disbursal' },
		{ value: 'loan_payoff', label: 'Loan Payoff' },
		{ value: 'lending_disbursal', label: 'Lending Disbursal' },
		{ value: 'lending_repayment', label: 'Lending Repayment' },
		{ value: 'adjustment', label: 'Adjustment' },
		{ value: 'opening_balance', label: 'Opening Balance' },
	];

	const TYPE_CONFIG: Record<
		JournalEntryType,
		{ debitLabel: string; creditLabel: string; debitRoot: string; creditRoot: string }
	> = {
		expense: {
			debitLabel: 'Expense Head (Debit) *',
			creditLabel: 'Asset Account (Credit) *',
			debitRoot: 'expense',
			creditRoot: 'asset',
		},
		income: {
			debitLabel: 'Asset Account (Debit) *',
			creditLabel: 'Income Head (Credit) *',
			debitRoot: 'asset',
			creditRoot: 'income',
		},
		transfer: {
			debitLabel: 'Destination Account (Debit) *',
			creditLabel: 'Source Account (Credit) *',
			debitRoot: 'asset',
			creditRoot: 'asset',
		},
		emi: {
			debitLabel: 'Loan / Liability Head (Debit) *',
			creditLabel: 'Paying Account (Credit) *',
			debitRoot: 'liability',
			creditRoot: 'asset',
		},
		credit_card_payment: {
			debitLabel: 'Credit Card Liability (Debit) *',
			creditLabel: 'Paying Account (Credit) *',
			debitRoot: 'liability',
			creditRoot: 'asset',
		},
		loan_disbursal: {
			debitLabel: 'Receiving Account (Debit) *',
			creditLabel: 'Loan Liability (Credit) *',
			debitRoot: 'asset',
			creditRoot: 'liability',
		},
		loan_payoff: {
			debitLabel: 'Loan Liability (Debit) *',
			creditLabel: 'Paying Account (Credit) *',
			debitRoot: 'liability',
			creditRoot: 'asset',
		},
		lending_disbursal: {
			debitLabel: 'Receivable / Asset Head (Debit) *',
			creditLabel: 'Funding Account (Credit) *',
			debitRoot: 'asset',
			creditRoot: 'asset',
		},
		lending_repayment: {
			debitLabel: 'Receiving Account (Debit) *',
			creditLabel: 'Receivable / Asset Head (Credit) *',
			debitRoot: 'asset',
			creditRoot: 'asset',
		},
		adjustment: {
			debitLabel: 'Debit Head *',
			creditLabel: 'Credit Head *',
			debitRoot: 'asset',
			creditRoot: 'equity',
		},
		opening_balance: {
			debitLabel: 'Opening Asset Head (Debit) *',
			creditLabel: 'Opening Counter Head (Credit) *',
			debitRoot: 'asset',
			creditRoot: 'equity',
		},
	};

	const cfg = TYPE_CONFIG[type];

	return (
		<form
			onSubmit={submit}
			className="flex flex-col gap-4 p-5 pt-2">
			<FormGrid>
				{allowTypeChange && (
					<FormField
						label="Transaction Type"
						span={2}>
						<Select
							value={type}
							onValueChange={(v) => setF({ ...f, type: v as JournalEntryType })}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{TYPE_OPTIONS.map((opt) => (
									<SelectItem
										key={opt.value}
										value={opt.value}>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</FormField>
				)}
				<FormField
					label="Description"
					span={2}>
					<Input
						value={f.description ?? ''}
						onChange={(e) => setF({ ...f, description: e.target.value })}
						placeholder={
							type === 'expense'
								? 'e.g. Swiggy lunch'
								: type === 'income'
									? 'e.g. Salary'
									: type === 'loan_disbursal'
										? 'e.g. Home loan disbursal'
										: type === 'loan_payoff'
											? 'e.g. Home loan prepayment'
											: type === 'lending_disbursal'
												? 'e.g. Lent to Rahul'
												: type === 'lending_repayment'
													? 'e.g. Repayment from Rahul'
													: 'e.g. Transfer to savings'
						}
						required
					/>
				</FormField>
				<FormField label="Amount (₹)">
					<Input
						type="number"
						min="0"
						step="0.01"
						value={f.amount ?? ''}
						onChange={(e) =>
							setF({ ...f, amount: parseFloat(e.target.value) || undefined })
						}
						required
					/>
				</FormField>
				<FormField label="Date">
					<Input
						type="date"
						value={f.date ?? ''}
						onChange={(e) => setF({ ...f, date: e.target.value })}
						required
					/>
				</FormField>

				{/* Debit side */}
				<FormField
					label={cfg.debitLabel}
					span={2}
					hint="The account being debited (Dr)">
					{lockedDebitId ? (
						<div className="flex h-9 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
							{accountHeads.find((h) => h.id === lockedDebitId)?.name ??
								lockedDebitId}
						</div>
					) : (
						<HeadSelect
							heads={accountHeads}
							value={f.debitAccountHeadId ?? ''}
							onChange={(v) => setF({ ...f, debitAccountHeadId: v })}
							rootType={cfg.debitRoot}
							placeholder="Select debit head"
						/>
					)}
				</FormField>

				{/* Credit side */}
				<FormField
					label={cfg.creditLabel}
					span={2}
					hint="The account being credited (Cr)">
					{lockedCreditId ? (
						<div className="flex h-9 items-center rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground">
							{accountHeads.find((h) => h.id === lockedCreditId)?.name ??
								lockedCreditId}
						</div>
					) : (
						<HeadSelect
							heads={accountHeads}
							value={f.creditAccountHeadId ?? ''}
							onChange={(v) => setF({ ...f, creditAccountHeadId: v })}
							rootType={cfg.creditRoot}
							placeholder="Select credit head"
						/>
					)}
				</FormField>

				<FormField
					label="Notes (optional)"
					span={2}>
					<Input
						value={f.notes ?? ''}
						onChange={(e) => setF({ ...f, notes: e.target.value })}
					/>
				</FormField>
			</FormGrid>
			<FormActions onCancel={onCancel} />
		</form>
	);
}

// Convenience wrappers that set the default type
export function ExpenseForm(props: Omit<JEFormProps, 'defaultType'>) {
	return (
		<JournalEntryForm
			{...props}
			defaultType="expense"
		/>
	);
}
export function IncomeForm(props: Omit<JEFormProps, 'defaultType'>) {
	return (
		<JournalEntryForm
			{...props}
			defaultType="income"
		/>
	);
}
export function TransferForm(props: Omit<JEFormProps, 'defaultType'>) {
	return (
		<JournalEntryForm
			{...props}
			defaultType="transfer"
		/>
	);
}

// ── RecurringPaymentForm ──────────────────────────────────────────────────────
export function RecurringPaymentForm({
	initialData,
	onSave,
	onCancel,
	accounts,
	accountHeads = [],
}: WithAccounts<RecurringPayment>) {
	const [f, setF] = useState<Partial<RecurringPayment>>({
		name: '',
		amount: undefined,
		frequency: 'monthly',
		nextDate: todayStr(),
		category: 'Housing',
		accountId: accounts[0]?.id ?? '',
		debitAccountHeadId: '',
		isActive: true,
		...initialData,
	});
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (f.name && f.amount) onSave(f);
	};

	// Expense-type heads for the debit side
	const expenseHeads = accountHeads.filter(
		(h) =>
			h.type === 'expense' ||
			h.parentId === 'head_expense' ||
			accountHeads.find((p) => p.id === h.parentId)?.type === 'expense'
	);

	return (
		<form
			onSubmit={submit}
			className="flex flex-col gap-4 p-5 pt-2">
			<FormGrid>
				<FormField
					label="Name"
					span={2}>
					<Input
						value={f.name ?? ''}
						onChange={(e) => setF({ ...f, name: e.target.value })}
						placeholder="e.g. Netflix, Rent, SIP"
						required
					/>
				</FormField>
				<FormField label="Amount (₹)">
					<Input
						type="number"
						min="0"
						value={f.amount ?? ''}
						onChange={(e) =>
							setF({ ...f, amount: parseFloat(e.target.value) || undefined })
						}
						required
					/>
				</FormField>
				<FormField label="Frequency">
					<Select
						value={f.frequency ?? 'monthly'}
						onValueChange={(v) => setF({ ...f, frequency: v as Frequency })}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{FREQS.map((fr) => (
								<SelectItem
									key={fr}
									value={fr}>
									{fr}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
				<FormField label="Next Due Date">
					<Input
						type="date"
						value={f.nextDate ?? ''}
						onChange={(e) => setF({ ...f, nextDate: e.target.value })}
						required
					/>
				</FormField>
				<FormField label="Category">
					<Select
						value={f.category ?? 'Housing'}
						onValueChange={(v) => setF({ ...f, category: v })}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{RECUR_CATS.map((c) => (
								<SelectItem
									key={c}
									value={c}>
									{c}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
				<FormField
					label="Default Credit Account (pay from)"
					span={2}
					hint="Which account to debit money from when paying">
					<Select
						value={f.accountId ?? ''}
						onValueChange={(v) => setF({ ...f, accountId: v })}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{accounts.map((a) => (
								<SelectItem
									key={a.id}
									value={a.id}>
									{a.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
				<FormField
					label="Default Expense Head (debit)"
					span={2}
					hint="The expense account head (e.g. Bills → Netflix). Can be changed at pay time.">
					<HeadSelect
						heads={accountHeads}
						value={f.debitAccountHeadId ?? ''}
						onChange={(v) => setF({ ...f, debitAccountHeadId: v })}
						rootType="expense"
						placeholder="Select or create expense head…"
					/>
				</FormField>
			</FormGrid>
			<FormActions onCancel={onCancel} />
		</form>
	);
}

// ── RecurringIncomeForm ───────────────────────────────────────────────────────
export function RecurringIncomeForm({
	initialData,
	onSave,
	onCancel,
	accounts,
}: WithAccounts<RecurringIncome>) {
	const [f, setF] = useState<Partial<RecurringIncome>>({
		name: '',
		amount: undefined,
		frequency: 'monthly',
		nextDate: todayStr(),
		accountId: accounts[0]?.id ?? '',
		isActive: true,
		...initialData,
	});
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (f.name && f.amount) onSave(f);
	};
	return (
		<form
			onSubmit={submit}
			className="flex flex-col gap-4 p-5 pt-2">
			<FormGrid>
				<FormField
					label="Source Name"
					span={2}>
					<Input
						value={f.name ?? ''}
						onChange={(e) => setF({ ...f, name: e.target.value })}
						placeholder="e.g. Salary"
						required
					/>
				</FormField>
				<FormField label="Amount (₹)">
					<Input
						type="number"
						min="0"
						value={f.amount ?? ''}
						onChange={(e) =>
							setF({ ...f, amount: parseFloat(e.target.value) || undefined })
						}
						required
					/>
				</FormField>
				<FormField label="Frequency">
					<Select
						value={f.frequency ?? 'monthly'}
						onValueChange={(v) => setF({ ...f, frequency: v as Frequency })}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{FREQS.map((fr) => (
								<SelectItem
									key={fr}
									value={fr}>
									{fr}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
				<FormField label="Next Date">
					<Input
						type="date"
						value={f.nextDate ?? ''}
						onChange={(e) => setF({ ...f, nextDate: e.target.value })}
						required
					/>
				</FormField>
				<FormField label="Credit Account">
					<Select
						value={f.accountId ?? ''}
						onValueChange={(v) => setF({ ...f, accountId: v })}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{accounts.map((a) => (
								<SelectItem
									key={a.id}
									value={a.id}>
									{a.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
				<FormField
					label="Notes (optional)"
					span={2}>
					<Input
						value={f.notes ?? ''}
						onChange={(e) => setF({ ...f, notes: e.target.value })}
					/>
				</FormField>
			</FormGrid>
			<FormActions onCancel={onCancel} />
		</form>
	);
}

// ── LoanForm ──────────────────────────────────────────────────────────────────
export function LoanForm({ initialData, onSave, onCancel, accounts }: WithAccounts<Loan>) {
	const [f, setF] = useState<Partial<Loan>>({
		name: '',
		loanType: 'normal',
		principalAmount: undefined,
		interestRate: undefined,
		tenureMonths: undefined,
		paidMonths: 0,
		startDate: todayStr(),
		accountId: accounts[0]?.id ?? '',
		emi: 0,
		taxRate: undefined,
		taxIncludedInRate: false,
		...initialData,
	});
	const computedEMI =
		f.principalAmount && f.interestRate !== undefined && f.tenureMonths
			? calculateEMI(f.principalAmount, f.interestRate, f.tenureMonths)
			: 0;
	const effectiveEMI = f.emi || computedEMI;
	const estMonthlyInterest =
		computedEMI > 0 && f.principalAmount
			? Math.round((f.principalAmount * (f.interestRate ?? 0)) / 12 / 100)
			: 0;
	const estTaxPerEMI =
		f.taxRate && estMonthlyInterest ? Math.round((estMonthlyInterest * f.taxRate) / 100) : 0;
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (f.name && f.principalAmount && f.tenureMonths) onSave({ ...f, emi: effectiveEMI });
	};
	return (
		<form
			onSubmit={submit}
			className="flex flex-col gap-4 p-5 pt-2">
			<FormGrid>
				<FormField
					label="Loan Name"
					span={2}>
					<Input
						value={f.name ?? ''}
						onChange={(e) => setF({ ...f, name: e.target.value })}
						required
					/>
				</FormField>
				<FormField label="Type">
					<Select
						value={f.loanType ?? 'normal'}
						onValueChange={(v) => setF({ ...f, loanType: v as LoanType })}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="normal">Normal Loan</SelectItem>
							<SelectItem value="credit_card">CC Loan</SelectItem>
						</SelectContent>
					</Select>
				</FormField>
				<FormField label="Principal (₹)">
					<Input
						type="number"
						min="0"
						value={f.principalAmount ?? ''}
						onChange={(e) =>
							setF({ ...f, principalAmount: parseFloat(e.target.value) || undefined })
						}
						required
					/>
				</FormField>
				<FormField label="Interest Rate (% p.a.)">
					<Input
						type="number"
						min="0"
						step="0.01"
						value={f.interestRate ?? ''}
						onChange={(e) =>
							setF({ ...f, interestRate: parseFloat(e.target.value) || undefined })
						}
					/>
				</FormField>
				<FormField label="Tenure (months)">
					<Input
						type="number"
						min="1"
						value={f.tenureMonths ?? ''}
						onChange={(e) =>
							setF({ ...f, tenureMonths: parseInt(e.target.value) || undefined })
						}
						required
					/>
				</FormField>
				<FormField label={`EMI — Auto: ₹${computedEMI.toLocaleString('en-IN')}`}>
					<Input
						type="number"
						min="0"
						value={f.emi || ''}
						onChange={(e) => setF({ ...f, emi: parseFloat(e.target.value) || 0 })}
						placeholder={computedEMI ? String(computedEMI) : 'auto'}
					/>
				</FormField>
				<FormField label="Months Paid">
					<Input
						type="number"
						min="0"
						value={f.paidMonths ?? 0}
						onChange={(e) => setF({ ...f, paidMonths: parseInt(e.target.value) || 0 })}
					/>
				</FormField>
				<FormField label="Start Date">
					<Input
						type="date"
						value={f.startDate ?? ''}
						onChange={(e) => setF({ ...f, startDate: e.target.value })}
						required
					/>
				</FormField>
				<FormField label="Tax on Interest (%)">
					<Input
						type="number"
						min="0"
						max="50"
						step="0.01"
						value={f.taxRate ?? ''}
						onChange={(e) =>
							setF({ ...f, taxRate: parseFloat(e.target.value) || undefined })
						}
						placeholder="e.g. 18"
					/>
				</FormField>
				<FormField label="Tax Included?">
					<Select
						value={f.taxIncludedInRate ? 'yes' : 'no'}
						onValueChange={(v) => setF({ ...f, taxIncludedInRate: v === 'yes' })}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="no">No — tax on top</SelectItem>
							<SelectItem value="yes">Yes — included</SelectItem>
						</SelectContent>
					</Select>
				</FormField>
				{estTaxPerEMI > 0 && (
					<div className="col-span-2 rounded-lg bg-warning/10 border border-warning/25 p-3 text-xs text-warning">
						Est. tax/EMI:{' '}
						<span className="font-mono font-bold">
							₹{estTaxPerEMI.toLocaleString('en-IN')}
						</span>{' '}
						· Total:{' '}
						<span className="font-mono font-bold">
							₹{(effectiveEMI + estTaxPerEMI).toLocaleString('en-IN')}
						</span>
					</div>
				)}
				<FormField
					label="Debit Account"
					span={2}>
					<Select
						value={f.accountId ?? ''}
						onValueChange={(v) => setF({ ...f, accountId: v })}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{accounts.map((a) => (
								<SelectItem
									key={a.id}
									value={a.id}>
									{a.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
				<FormField
					label="Notes (optional)"
					span={2}>
					<Textarea
						value={f.notes ?? ''}
						onChange={(e) => setF({ ...f, notes: e.target.value })}
						rows={2}
					/>
				</FormField>
			</FormGrid>
			<FormActions onCancel={onCancel} />
		</form>
	);
}

// ── CreditCardForm ────────────────────────────────────────────────────────────
export function CreditCardForm({ initialData, onSave, onCancel }: FP<Account>) {
	const existingCard = initialData?.creditCard;
	const [f, setF] = useState<Partial<Account>>({
		name: '',
		type: 'credit_card',
		openingBalance: 0,
		creditCard: {
			limit: existingCard?.limit ?? 0,
			outstanding: existingCard?.outstanding ?? 0,
			statementDay: existingCard?.statementDay ?? 1,
			billingCycleDays: existingCard?.billingCycleDays ?? 30,
			gracePeriodDays: existingCard?.gracePeriodDays ?? 20,
			dueDate: existingCard?.dueDate ?? todayStr(),
			statementDate: existingCard?.statementDate ?? todayStr(),
			taxRate: existingCard?.taxRate,
		},
		...initialData,
	});
	const cc = f.creditCard;
	const previewDueDate: string | null =
		cc?.statementDay && cc.gracePeriodDays !== undefined
			? (() => {
					const s = nextStatementDate({
						statementDay: cc.statementDay,
						billingCycleDays: cc.billingCycleDays ?? 30,
					});
					return dueFromStatement(s, cc.gracePeriodDays).toISOString().split('T')[0];
				})()
			: null;
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (f.name && cc && cc.limit !== undefined) {
			const sd = cc.statementDay
				? nextStatementDate({
						statementDay: cc.statementDay,
						billingCycleDays: cc.billingCycleDays ?? 30,
					})
						.toISOString()
						.split('T')[0]
				: (cc.statementDate ?? todayStr());

			onSave({
				...f,
				type: 'credit_card',
				openingBalance: f.openingBalance ?? -(cc.outstanding ?? 0),
				creditCard: {
					...cc,
					dueDate: previewDueDate ?? cc.dueDate ?? todayStr(),
					statementDate: sd,
				},
			});
		}
	};
	return (
		<form
			onSubmit={submit}
			className="flex flex-col gap-4 p-5 pt-2">
			<FormGrid>
				<FormField
					label="Card Name"
					span={2}>
					<Input
						value={f.name ?? ''}
						onChange={(e) => setF({ ...f, name: e.target.value })}
						placeholder="e.g. HDFC Regalia"
						required
					/>
				</FormField>
				<FormField label="Credit Limit (₹)">
					<Input
						type="number"
						min="0"
						value={cc?.limit ?? ''}
						onChange={(e) =>
							setF({
								...f,
								creditCard: {
									...(f.creditCard ?? {
										outstanding: 0,
										statementDay: 1,
										billingCycleDays: 30,
										gracePeriodDays: 20,
										dueDate: todayStr(),
										statementDate: todayStr(),
										limit: 0,
									}),
									limit: parseFloat(e.target.value) || 0,
								},
							})
						}
						required
					/>
				</FormField>
				<FormField label="Outstanding (₹)">
					<Input
						type="number"
						min="0"
						value={cc?.outstanding ?? ''}
						onChange={(e) =>
							setF({
								...f,
								creditCard: {
									...(f.creditCard ?? {
										limit: 0,
										statementDay: 1,
										billingCycleDays: 30,
										gracePeriodDays: 20,
										dueDate: todayStr(),
										statementDate: todayStr(),
										outstanding: 0,
									}),
									outstanding: parseFloat(e.target.value) || 0,
								},
								openingBalance: -(parseFloat(e.target.value) || 0),
							})
						}
					/>
				</FormField>
				<FormField label="Statement Day (1-28)">
					<Input
						type="number"
						min="1"
						max="28"
						value={cc?.statementDay ?? 1}
						onChange={(e) =>
							setF({
								...f,
								creditCard: {
									...(f.creditCard ?? {
										limit: 0,
										outstanding: 0,
										billingCycleDays: 30,
										gracePeriodDays: 20,
										dueDate: todayStr(),
										statementDate: todayStr(),
										statementDay: 1,
									}),
									statementDay: parseInt(e.target.value) || 1,
								},
							})
						}
					/>
				</FormField>
				<FormField label="Billing Cycle (days)">
					<Input
						type="number"
						min="1"
						value={cc?.billingCycleDays ?? 30}
						onChange={(e) =>
							setF({
								...f,
								creditCard: {
									...(f.creditCard ?? {
										limit: 0,
										outstanding: 0,
										statementDay: 1,
										gracePeriodDays: 20,
										dueDate: todayStr(),
										statementDate: todayStr(),
										billingCycleDays: 30,
									}),
									billingCycleDays: parseInt(e.target.value) || 30,
								},
							})
						}
					/>
				</FormField>
				<FormField label="Grace Period (days)">
					<Input
						type="number"
						min="0"
						value={cc?.gracePeriodDays ?? 20}
						onChange={(e) =>
							setF({
								...f,
								creditCard: {
									...(f.creditCard ?? {
										limit: 0,
										outstanding: 0,
										statementDay: 1,
										billingCycleDays: 30,
										dueDate: todayStr(),
										statementDate: todayStr(),
										gracePeriodDays: 20,
									}),
									gracePeriodDays: parseInt(e.target.value) || 20,
								},
							})
						}
					/>
				</FormField>
				{previewDueDate && (
					<div className="col-span-2 rounded-lg bg-cyan/10 border border-cyan/25 p-2 text-xs text-cyan">
						Next due date: <span className="font-mono font-bold">{previewDueDate}</span>
					</div>
				)}
				<FormField label="Tax on Interest (%)">
					<Input
						type="number"
						min="0"
						value={cc?.taxRate ?? ''}
						onChange={(e) =>
							setF({
								...f,
								creditCard: {
									...(f.creditCard ?? {
										limit: 0,
										outstanding: 0,
										statementDay: 1,
										billingCycleDays: 30,
										gracePeriodDays: 20,
										dueDate: todayStr(),
										statementDate: todayStr(),
									}),
									taxRate: parseFloat(e.target.value) || undefined,
								},
							})
						}
					/>
				</FormField>
				<FormField
					label="Notes (optional)"
					span={2}>
					<Textarea
						value={f.notes ?? ''}
						onChange={(e) => setF({ ...f, notes: e.target.value })}
						rows={2}
					/>
				</FormField>
			</FormGrid>
			<FormActions onCancel={onCancel} />
		</form>
	);
}

// ── ReceivableForm ────────────────────────────────────────────────────────────
export function ReceivableForm({
	initialData,
	onSave,
	onCancel,
	accounts,
	accountHeads,
}: WithAccounts<Receivable>) {
	const [f, setF] = useState<Partial<Receivable>>({
		personName: '',
		amountLent: undefined,
		amountRepaid: 0,
		dateLent: todayStr(),
		accountId: accounts[0]?.id ?? '',
		receivableHeadId: 'head_asset',
		isSettled: false,
		...initialData,
	});
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (f.personName && f.amountLent) onSave(f);
	};
	return (
		<form
			onSubmit={submit}
			className="flex flex-col gap-4 p-5 pt-2">
			<FormGrid>
				<FormField
					label="Person / Entity"
					span={2}>
					<Input
						value={f.personName ?? ''}
						onChange={(e) => setF({ ...f, personName: e.target.value })}
						required
					/>
				</FormField>
				<FormField label="Amount Lent (₹)">
					<Input
						type="number"
						min="0"
						value={f.amountLent ?? ''}
						onChange={(e) =>
							setF({ ...f, amountLent: parseFloat(e.target.value) || undefined })
						}
						required
					/>
				</FormField>
				<FormField label="Date Lent">
					<Input
						type="date"
						value={f.dateLent ?? ''}
						onChange={(e) => setF({ ...f, dateLent: e.target.value })}
						required
					/>
				</FormField>
				<FormField label="Expected Repayment">
					<Input
						type="date"
						value={f.expectedRepaymentDate ?? ''}
						onChange={(e) => setF({ ...f, expectedRepaymentDate: e.target.value })}
					/>
				</FormField>
				<FormField label="From Account">
					<Select
						value={f.accountId ?? ''}
						onValueChange={(v) => setF({ ...f, accountId: v })}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{accounts.map((a) => (
								<SelectItem
									key={a.id}
									value={a.id}>
									{a.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
				<FormField
					label="Receivable Head"
					span={2}
					hint="Asset head that tracks amount due from borrower">
					<HeadSelect
						heads={accountHeads ?? []}
						value={f.receivableHeadId ?? 'head_asset'}
						onChange={(v) => setF({ ...f, receivableHeadId: v })}
						rootType="asset"
						placeholder="Select receivable asset head"
					/>
				</FormField>
				<FormField
					label="Description"
					span={2}>
					<Input
						value={f.description ?? ''}
						onChange={(e) => setF({ ...f, description: e.target.value })}
					/>
				</FormField>
				<FormField
					label="Notes (optional)"
					span={2}>
					<Textarea
						value={f.notes ?? ''}
						onChange={(e) => setF({ ...f, notes: e.target.value })}
						rows={2}
					/>
				</FormField>
			</FormGrid>
			<FormActions onCancel={onCancel} />
		</form>
	);
}

export function RepaymentForm({
	receivableId,
	accounts,
	defaultAccountId,
	onSave,
	onCancel,
}: {
	receivableId: string;
	accounts: Account[];
	defaultAccountId?: string;
	onSave: (d: Partial<RepaymentRecord>) => void;
	onCancel: () => void;
}) {
	const [f, setF] = useState<Partial<RepaymentRecord>>({
		receivableId,
		amount: undefined,
		date: todayStr(),
		accountId: defaultAccountId ?? accounts[0]?.id ?? '',
	});
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (f.amount) onSave(f);
	};
	return (
		<form
			onSubmit={submit}
			className="flex flex-col gap-4 p-5 pt-2">
			<FormGrid>
				<FormField label="Amount Received (₹)">
					<Input
						type="number"
						min="0"
						value={f.amount ?? ''}
						onChange={(e) =>
							setF({ ...f, amount: parseFloat(e.target.value) || undefined })
						}
						required
					/>
				</FormField>
				<FormField label="Date">
					<Input
						type="date"
						value={f.date ?? ''}
						onChange={(e) => setF({ ...f, date: e.target.value })}
						required
					/>
				</FormField>
				<FormField label="Receive Into Account">
					<Select
						value={f.accountId ?? ''}
						onValueChange={(v) => setF({ ...f, accountId: v })}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{accounts.map((a) => (
								<SelectItem
									key={a.id}
									value={a.id}>
									{a.name}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
				<FormField
					label="Notes (optional)"
					span={2}>
					<Input
						value={f.notes ?? ''}
						onChange={(e) => setF({ ...f, notes: e.target.value })}
					/>
				</FormField>
			</FormGrid>
			<FormActions
				onCancel={onCancel}
				saveLabel="Record Repayment"
			/>
		</form>
	);
}

export function InvestmentForm({ initialData, onSave, onCancel }: FP<Investment>) {
	const [f, setF] = useState<Partial<Investment>>({
		name: '',
		value: undefined,
		type: 'stocks',
		...initialData,
	});
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (f.name && f.value) onSave(f);
	};
	return (
		<form
			onSubmit={submit}
			className="flex flex-col gap-4 p-5 pt-2">
			<FormGrid>
				<FormField
					label="Name"
					span={2}>
					<Input
						value={f.name ?? ''}
						onChange={(e) => setF({ ...f, name: e.target.value })}
						required
					/>
				</FormField>
				<FormField label="Current Value (₹)">
					<Input
						type="number"
						min="0"
						value={f.value ?? ''}
						onChange={(e) =>
							setF({ ...f, value: parseFloat(e.target.value) || undefined })
						}
						required
					/>
				</FormField>
				<FormField label="Cost Basis (₹)">
					<Input
						type="number"
						min="0"
						value={f.costBasis ?? ''}
						onChange={(e) =>
							setF({ ...f, costBasis: parseFloat(e.target.value) || undefined })
						}
					/>
				</FormField>
				<FormField
					label="Type"
					span={2}>
					<Select
						value={f.type ?? 'stocks'}
						onValueChange={(v) => setF({ ...f, type: v as InvestmentType })}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{INV_TYPES.map((t) => (
								<SelectItem
									key={t}
									value={t}>
									{t.replace(/_/g, ' ')}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
				<FormField
					label="Notes (optional)"
					span={2}>
					<Input
						value={f.notes ?? ''}
						onChange={(e) => setF({ ...f, notes: e.target.value })}
					/>
				</FormField>
			</FormGrid>
			<FormActions onCancel={onCancel} />
		</form>
	);
}

export function ReconciliationForm({
	account,
	trackedBalance,
	onSave,
	onCancel,
}: {
	account: Account;
	trackedBalance: number;
	onSave: (d: Partial<Reconciliation>) => void;
	onCancel: () => void;
}) {
	const [actual, setActual] = useState('');
	const [notes, setNotes] = useState('');
	const actualNum = parseFloat(actual) || 0;
	const diff = actualNum - trackedBalance;
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (!actual) return;
		onSave({
			accountId: account.id,
			reconciledDate: todayStr(),
			trackedBalance,
			actualBalance: actualNum,
			difference: diff,
			status: 'completed',
			notes,
		});
	};
	return (
		<form
			onSubmit={submit}
			className="flex flex-col gap-4 p-5 pt-2">
			<div className="rounded-lg bg-muted/50 p-3 text-sm">
				<p className="text-muted-foreground">
					Account: <span className="font-semibold text-foreground">{account.name}</span>
				</p>
				<p className="text-muted-foreground mt-1">
					Tracked balance:{' '}
					<span className="font-mono font-bold text-foreground">
						₹{trackedBalance.toLocaleString('en-IN')}
					</span>
				</p>
			</div>
			<FormField label="Actual Balance (₹)">
				<Input
					type="number"
					step="0.01"
					value={actual}
					onChange={(e) => setActual(e.target.value)}
					required
					autoFocus
				/>
			</FormField>
			{actual && (
				<div
					className={`rounded-lg p-3 text-sm font-semibold ${diff === 0 ? 'bg-profit/10 text-profit' : 'bg-warning/10 text-warning'}`}>
					{diff === 0
						? '✓ Balanced'
						: diff > 0
							? `Actual is ₹${Math.abs(diff).toLocaleString('en-IN')} higher`
							: `Actual is ₹${Math.abs(diff).toLocaleString('en-IN')} lower`}
				</div>
			)}
			<FormField label="Notes (optional)">
				<Textarea
					value={notes}
					onChange={(e) => setNotes(e.target.value)}
					rows={2}
				/>
			</FormField>
			<FormActions
				onCancel={onCancel}
				saveLabel="Reconcile"
			/>
		</form>
	);
}

export function GoalForm({ initialData, onSave, onCancel }: FP<Goal>) {
	const [f, setF] = useState<Partial<Goal>>({
		name: '',
		type: 'savings',
		targetAmount: undefined,
		currentAmount: 0,
		status: 'active',
		icon: '🎯',
		...initialData,
	});
	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (f.name && f.targetAmount)
			onSave({ ...f, icon: GOAL_ICONS[f.type as GoalType] ?? '🎯' });
	};
	return (
		<form
			onSubmit={submit}
			className="flex flex-col gap-4 p-5 pt-2">
			<FormGrid>
				<FormField
					label="Goal Name"
					span={2}>
					<Input
						value={f.name ?? ''}
						onChange={(e) => setF({ ...f, name: e.target.value })}
						required
					/>
				</FormField>
				<FormField
					label="Goal Type"
					span={2}>
					<Select
						value={f.type ?? 'savings'}
						onValueChange={(v) => setF({ ...f, type: v as GoalType })}>
						<SelectTrigger>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{GOAL_TYPES.map((t) => (
								<SelectItem
									key={t}
									value={t}>
									{GOAL_ICONS[t]} {t.replace(/_/g, ' ')}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</FormField>
				<FormField label="Target (₹)">
					<Input
						type="number"
						min="0"
						value={f.targetAmount ?? ''}
						onChange={(e) =>
							setF({ ...f, targetAmount: parseFloat(e.target.value) || undefined })
						}
						required
					/>
				</FormField>
				<FormField label="Current (₹)">
					<Input
						type="number"
						min="0"
						value={f.currentAmount ?? ''}
						onChange={(e) =>
							setF({ ...f, currentAmount: parseFloat(e.target.value) || 0 })
						}
					/>
				</FormField>
				<FormField label="Monthly (₹)">
					<Input
						type="number"
						min="0"
						value={f.monthlyContribution ?? ''}
						onChange={(e) =>
							setF({
								...f,
								monthlyContribution: parseFloat(e.target.value) || undefined,
							})
						}
					/>
				</FormField>
				<FormField label="Target Date">
					<Input
						type="date"
						value={f.targetDate ?? ''}
						onChange={(e) => setF({ ...f, targetDate: e.target.value })}
					/>
				</FormField>
				<FormField
					label="Notes (optional)"
					span={2}>
					<Textarea
						value={f.notes ?? ''}
						onChange={(e) => setF({ ...f, notes: e.target.value })}
						rows={2}
					/>
				</FormField>
			</FormGrid>
			<FormActions onCancel={onCancel} />
		</form>
	);
}
