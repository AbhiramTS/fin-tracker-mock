// ─────────────────────────────────────────────────────────────────────────────
//  types.ts  –  FinTracker v4  (double-entry rebuild)
// ─────────────────────────────────────────────────────────────────────────────

export interface BaseRecord {
	id: string;
	createdAt: string;
	updatedAt: string;
}

// ── Chart of Accounts ─────────────────────────────────────────────────────────
// Five root heads are fixed and cannot be deleted.
// Users may create sub-heads under any root.

export type RootAccountHeadType = 'asset' | 'liability' | 'income' | 'expense' | 'equity';

export interface AccountHead extends BaseRecord {
	name: string;
	type: RootAccountHeadType;
	parentId: string | null; // null = root head
	isSystem: boolean; // true = built-in, cannot be deleted
	notes?: string;
}

// Built-in root heads (seeded on first launch)
export const ROOT_HEADS: Omit<AccountHead, 'createdAt' | 'updatedAt'>[] = [
	{ id: 'head_asset', name: 'Assets', type: 'asset', parentId: null, isSystem: true },
	{
		id: 'head_liability',
		name: 'Liabilities',
		type: 'liability',
		parentId: null,
		isSystem: true,
	},
	{ id: 'head_income', name: 'Income', type: 'income', parentId: null, isSystem: true },
	{ id: 'head_expense', name: 'Expenses', type: 'expense', parentId: null, isSystem: true },
	{ id: 'head_equity', name: 'Equity', type: 'equity', parentId: null, isSystem: true },
];

// ── Accounts ──────────────────────────────────────────────────────────────────
export type AccountType = 'bank' | 'cash' | 'credit_card' | 'loan' | 'investment' | 'receivable';

export interface Account extends BaseRecord {
	name: string;
	type: AccountType;
	openingBalance: number; // balance before any recorded transactions
	color?: string;
	currency?: string; // default "INR"
	notes?: string;
	isArchived?: boolean;
	accountHeadId?: string; // which AccountHead this account maps to
}

// ── Transactions ──────────────────────────────────────────────────────────────
// Every transaction MUST carry an accountHeadId (double-entry requirement).
// A transaction records the economic event on ONE account.
// Transfers create two transactions (debit + credit) linked by a transferId.

export interface Expense extends BaseRecord {
	name: string;
	amount: number;
	date: string;
	category: string;
	accountId: string;
	accountHeadId: string; // REQUIRED — the expense account head
	notes?: string;
	tags?: string[];
	isRecurring?: boolean;
	recurringId?: string; // if converted to/from a recurring payment
}

export interface Income extends BaseRecord {
	name: string;
	amount: number;
	date: string;
	accountId: string;
	accountHeadId: string; // REQUIRED — the income account head
	category?: string;
	notes?: string;
	isRecurring?: boolean;
	recurringId?: string;
}

export interface Transfer extends BaseRecord {
	fromAccountId: string;
	toAccountId: string;
	amount: number;
	date: string;
	fromAccountHeadId: string; // REQUIRED — account head for the debit side
	toAccountHeadId: string; // REQUIRED — account head for the credit side
	notes?: string;
}

// ── Computed balances (derived, not stored) ───────────────────────────────────
// Keyed by accountId. Populated by the balance worker.
export type ComputedBalances = Record<string, number>;

// ── Recurring items ───────────────────────────────────────────────────────────
export type Frequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringPayment extends BaseRecord {
	name: string;
	amount: number;
	frequency: Frequency;
	nextDate: string;
	category: string;
	accountId: string;
	notes?: string;
	isActive: boolean;
}

export interface RecurringIncome extends BaseRecord {
	name: string;
	amount: number;
	frequency: Frequency;
	nextDate: string;
	accountId: string;
	notes?: string;
	isActive: boolean;
}

// ── Payment occurrences ───────────────────────────────────────────────────────
export type PaymentOccurrenceStatus = 'unpaid' | 'paid' | 'skipped';

export type PaymentOccurrenceKind =
	| 'recurring_payment'
	| 'recurring_income'
	| 'loan_emi'
	| 'credit_card_bill';

export interface PaymentOccurrence extends BaseRecord {
	kind: PaymentOccurrenceKind;
	sourceId: string;
	dueDate: string;
	amount: number;
	status: PaymentOccurrenceStatus;
	paidDate?: string;
	paidAmount?: number;
	transactionId?: string;
	notes?: string;
	label: string;
	category?: string;
	accountId?: string;
}

// ── Loans & amortisation ──────────────────────────────────────────────────────
export type LoanType = 'normal' | 'credit_card';

export interface Loan extends BaseRecord {
	name: string;
	loanType: LoanType;
	principalAmount: number;
	interestRate: number;
	tenureMonths: number;
	startDate: string;
	emi: number;
	paidMonths: number;
	accountId: string;
	linkedCreditCardId?: string;
	taxRate?: number;
	taxIncludedInRate?: boolean;
	notes?: string;
}

export interface AmortisationRow {
	month: number;
	date: string;
	openingBalance: number;
	emi: number;
	principal: number;
	interest: number;
	tax: number;
	totalPayable: number;
	closingBalance: number;
	isPaid: boolean;
}

// ── Credit cards ──────────────────────────────────────────────────────────────
export interface CreditCard extends BaseRecord {
	name: string;
	limit: number;
	outstanding: number;
	statementDay: number;
	billingCycleDays: number;
	gracePeriodDays: number;
	dueDate: string;
	statementDate: string;
	taxRate?: number;
	notes?: string;
}

// ── Receivables ───────────────────────────────────────────────────────────────
export interface Receivable extends BaseRecord {
	personName: string;
	description?: string;
	amountLent: number;
	amountRepaid: number;
	dateLent: string;
	expectedRepaymentDate?: string;
	accountId: string;
	isSettled: boolean;
	notes?: string;
}

export interface RepaymentRecord extends BaseRecord {
	receivableId: string;
	amount: number;
	date: string;
	notes?: string;
}

// ── Investments ───────────────────────────────────────────────────────────────
export type InvestmentType =
	| 'stocks'
	| 'mutual_fund'
	| 'ppf'
	| 'fd'
	| 'nps'
	| 'crypto'
	| 'real_estate'
	| 'gold'
	| 'other';

export interface Investment extends BaseRecord {
	name: string;
	value: number;
	costBasis?: number;
	type: InvestmentType;
	accountId?: string;
	notes?: string;
}

// ── Reconciliation ────────────────────────────────────────────────────────────
export type ReconciliationStatus = 'pending' | 'completed' | 'in_progress';

export interface Reconciliation extends BaseRecord {
	accountId: string;
	reconciledDate: string;
	trackedBalance: number;
	actualBalance: number;
	difference: number;
	status: ReconciliationStatus;
	adjustmentTransactionId?: string;
	notes?: string;
}

// ── Financial Goals ───────────────────────────────────────────────────────────
export type GoalType =
	| 'savings'
	| 'debt_payoff'
	| 'investment'
	| 'emergency_fund'
	| 'purchase'
	| 'custom';
export type GoalStatus = 'active' | 'completed' | 'paused';

export interface Goal extends BaseRecord {
	name: string;
	type: GoalType;
	targetAmount: number;
	currentAmount: number;
	targetDate?: string;
	monthlyContribution?: number;
	linkedAccountId?: string;
	status: GoalStatus;
	notes?: string;
	icon?: string;
}

// ── Import review (pending duplicate decisions) ───────────────────────────────
export type ImportReviewStatus = 'pending' | 'resolved';
export type ImportReviewDecision = 'skip' | 'overwrite' | 'create_new';

export interface ImportReview extends BaseRecord {
	sessionId: string; // groups all reviews from one import run
	entity: EntityName;
	incoming: Record<string, unknown>; // the record from the import file
	existing: Record<string, unknown>; // the matched existing record
	status: ImportReviewStatus;
	decision?: ImportReviewDecision;
	resolvedAt?: string;
}

// ── Sync / queue ──────────────────────────────────────────────────────────────
export type ChangeType = 'create' | 'update' | 'delete';

export interface ChangeRecord {
	queueId: string;
	entity: string;
	type: ChangeType;
	payload: Record<string, unknown>;
	createdAt: string;
	syncedAt: string | null;
}

export interface PushResult {
	synced: string[];
	failed: string[];
}

// ── App state ─────────────────────────────────────────────────────────────────
export type EntityName =
	| 'accounts'
	| 'accountHeads'
	| 'expenses'
	| 'incomes'
	| 'transfers'
	| 'recurringPayments'
	| 'recurringIncomes'
	| 'loans'
	| 'creditCards'
	| 'receivables'
	| 'repaymentRecords'
	| 'investments'
	| 'reconciliations'
	| 'goals'
	| 'paymentOccurrences'
	| 'importReviews';

export type SyncStatus = 'idle' | 'firebase' | 'rest';
export type SyncPhase = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncState {
	status: SyncStatus; // which adapter is connected
	phase: SyncPhase; // current operation state
	pendingCount: number; // changes not yet pushed to cloud
	lastSyncedAt: string | null;
	lastSyncedCount: number; // records synced in the last flush
	lastError: string | null;
}

export interface AppState {
	accounts: Account[];
	accountHeads: AccountHead[];
	expenses: Expense[];
	incomes: Income[];
	transfers: Transfer[];
	recurringPayments: RecurringPayment[];
	recurringIncomes: RecurringIncome[];
	loans: Loan[];
	creditCards: CreditCard[];
	receivables: Receivable[];
	repaymentRecords: RepaymentRecord[];
	investments: Investment[];
	reconciliations: Reconciliation[];
	goals: Goal[];
	paymentOccurrences: PaymentOccurrence[];
	importReviews: ImportReview[];
	computedBalances: ComputedBalances;
	loading: boolean;
	error: string | null;
	syncStatus: SyncStatus; // kept for backwards compat with existing reads
	sync: SyncState; // full sync detail
}

export type AppAction =
	| { type: 'LOAD_ALL'; payload: Partial<AppState> }
	| { type: 'SET_ERROR'; payload: string }
	| { type: 'SET_SYNC'; payload: SyncStatus }
	| { type: 'SET_SYNC_STATE'; payload: Partial<SyncState> }
	| { type: 'UPSERT'; payload: { entity: EntityName; record: BaseRecord } }
	| { type: 'REMOVE'; payload: { entity: EntityName; id: string } }
	| { type: 'RELOAD_ENTITY'; payload: { entity: EntityName; records: BaseRecord[] } }
	| { type: 'SET_BALANCES'; payload: ComputedBalances };

// ── Forecast types ────────────────────────────────────────────────────────────
export interface ForecastEvent {
	date: string;
	label: string;
	amount: number;
	type: 'income' | 'payment' | 'emi' | 'credit' | 'goal_contribution';
}

export interface ForecastDay {
	date: string;
	balance: number;
	events: ForecastEvent[];
}

export interface ForecastResult {
	timeline: ForecastDay[];
	shortfall: ForecastDay | null;
	safeToSpend: number;
	totalBalance: number;
	monthlyObligations: number;
}

// ── Firebase config ───────────────────────────────────────────────────────────
export interface FirebaseConfig {
	apiKey: string;
	authDomain: string;
	projectId: string;
	storageBucket?: string;
	messagingSenderId?: string;
	appId: string;
	databaseURL?: string;
}
