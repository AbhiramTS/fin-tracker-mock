// ─────────────────────────────────────────────────────────────────────────────
//  types.ts  –  FinTracker v4  (unified double-entry model)
// ─────────────────────────────────────────────────────────────────────────────

export interface BaseRecord {
	id: string;
	createdAt: string;
	updatedAt: string;
}

// ── Chart of Accounts ─────────────────────────────────────────────────────────
// Five root heads are fixed.  Every bank account, credit card and loan
// is ALSO an AccountHead (same id) placed under the correct root.
// User-defined sub-heads (Food, Salary, Netflix…) live here too.

export type RootAccountHeadType = 'asset' | 'liability' | 'income' | 'expense' | 'equity';

export interface AccountHead extends BaseRecord {
	name: string;
	type: RootAccountHeadType;
	parentId: string | null; // null = root head
	isSystem: boolean; // true = built-in root, cannot be deleted
	isAccount?: boolean; // true = auto-created mirror of an Account/Loan
	notes?: string;
}

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

// Root head id for a given account type
export function rootHeadForAccountType(type: AccountType): string {
	switch (type) {
		case 'bank':
		case 'cash':
		case 'investment':
		case 'receivable':
			return 'head_asset';
		case 'credit_card':
		case 'loan':
			return 'head_liability';
	}
}

// ── Accounts ──────────────────────────────────────────────────────────────────
// An Account is ALSO an AccountHead (shares the same id).
// AccountHead is auto-created/updated/deleted when an Account is saved/removed.

export type AccountType = 'bank' | 'cash' | 'credit_card' | 'loan' | 'investment' | 'receivable';

export interface CreditCardDetails {
	limit: number;
	outstanding: number;
	statementDay: number;
	billingCycleDays: number;
	gracePeriodDays: number;
	dueDate: string;
	statementDate: string;
	taxRate?: number;
}

export interface Account extends BaseRecord {
	name: string;
	type: AccountType;
	openingBalance: number;
	creditCard?: CreditCardDetails;
	color?: string;
	currency?: string;
	notes?: string;
	isArchived?: boolean;
}

// ── Journal Entries (unified transaction model) ───────────────────────────────
// Every economic event is ONE journal entry with explicit debit + credit sides.
//
//  Expense  (Netflix ₹649 from HDFC):
//    debit  = Bills → Netflix     (expense head)
//    credit = Assets → HDFC       (account head = HDFC account id)
//
//  Income   (Salary ₹85k into HDFC):
//    debit  = Assets → HDFC       (account head)
//    credit = Income → Salary     (income head)
//
//  Transfer (₹10k HDFC → ICICI):
//    debit  = Assets → ICICI      (account head)
//    credit = Assets → HDFC       (account head)

export type JournalEntryType =
	| 'expense'
	| 'income'
	| 'transfer'
	| 'emi'
	| 'credit_card_payment'
	| 'loan_disbursal'
	| 'loan_payoff'
	| 'lending_disbursal'
	| 'lending_repayment'
	| 'adjustment'
	| 'opening_balance';

export interface JournalEntry extends BaseRecord {
	date: string; // yyyy-MM-dd
	sortOrder?: number; // persistent manual order within the same date
	description: string;
	amount: number; // always positive
	type: JournalEntryType;
	emiNumber?: number; // EMI installment number for loan EMI entries
	debitAccountHeadId: string; // account head being debited
	creditAccountHeadId: string; // account head being credited
	notes?: string;
	tags?: string[];
	// Convenience back-refs for balance worker (the "real" account ids)
	// These are the AccountHead ids that correspond to actual Accounts
	// i.e. if debit/credit head IS an account, its id here equals accountId
	linkedAccountIds?: string[]; // [debitId, creditId] when they are accounts
}

// ── Computed balances (derived, not stored) ───────────────────────────────────
export type ComputedBalances = Record<string, number>;

// ── Recurring items ───────────────────────────────────────────────────────────
export type Frequency = 'daily' | 'weekly' | 'fortnightly' | 'monthly' | 'quarterly' | 'yearly';
export type MonthScheduleRule = 'same_day' | 'last_day' | 'last_working_day';

export interface RecurringPayment extends BaseRecord {
	name: string;
	amount: number;
	frequency: Frequency;
	nextDate: string;
	monthScheduleRule?: MonthScheduleRule;
	category: string;
	accountId: string; // credit side (bank account to pay from)
	debitAccountHeadId?: string; // expense head (e.g. "Bills → Netflix") — optional default
	notes?: string;
	isActive: boolean;
}

export interface RecurringIncome extends BaseRecord {
	name: string;
	amount: number;
	frequency: Frequency;
	nextDate: string;
	monthScheduleRule?: MonthScheduleRule;
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
	emiNumber?: number; // installment number for loan EMI occurrences
	status: PaymentOccurrenceStatus;
	paidDate?: string;
	paidAmount?: number;
	transactionId?: string; // id of JournalEntry created on mark-paid
	notes?: string;
	label: string;
	category?: string;
	accountId?: string; // default credit account
	debitAccountHeadId?: string; // pre-filled debit head
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

// ── Receivables ───────────────────────────────────────────────────────────────
export interface Receivable extends BaseRecord {
	personName: string;
	description?: string;
	openingBalance?: number;
	amountLent: number;
	dateLent: string;
	expectedRepaymentDate?: string;
	accountId: string;
	receivableHeadId?: string;
	notes?: string;
}

export interface RepaymentRecord extends BaseRecord {
	receivableId: string;
	amount: number;
	date: string;
	accountId?: string;
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

// ── Import review ─────────────────────────────────────────────────────────────
export type ImportReviewStatus = 'pending' | 'resolved';
export type ImportReviewDecision = 'skip' | 'overwrite' | 'create_new';

export interface ImportReview extends BaseRecord {
	sessionId: string;
	entity: EntityName;
	incoming: Record<string, unknown>;
	existing: Record<string, unknown>;
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
	| 'journalEntries'
	| 'recurringPayments'
	| 'recurringIncomes'
	| 'loans'
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
	status: SyncStatus;
	phase: SyncPhase;
	pendingCount: number;
	lastSyncedAt: string | null;
	lastSyncedCount: number;
	lastError: string | null;
}

export interface AppState {
	accounts: Account[];
	accountHeads: AccountHead[];
	journalEntries: JournalEntry[];
	recurringPayments: RecurringPayment[];
	recurringIncomes: RecurringIncome[];
	loans: Loan[];
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
	syncStatus: SyncStatus;
	sync: SyncState;
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
