// ─────────────────────────────────────────────────────────────────────────────
//  types.ts  –  All domain types for FinTracker v4
//  Aligns with BRD/PRD/FRD requirements including:
//    double-entry ledger, transfers, receivables, reconciliation, goals
// ─────────────────────────────────────────────────────────────────────────────

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// ── Accounts ──────────────────────────────────────────────────────────────────
export type AccountType =
  | "bank"        // standard bank account
  | "cash"        // physical cash wallet
  | "credit_card" // credit card (liability)
  | "loan"        // loan liability account
  | "investment"  // investment/brokerage account
  | "receivable"; // money lent to others

export interface Account extends BaseRecord {
  name: string;
  type: AccountType;
  balance: number;        // current tracked balance (positive = asset, negative = liability)
  color?: string;
  currency?: string;      // default "INR"
  notes?: string;
  isArchived?: boolean;
}

// ── Transactions ──────────────────────────────────────────────────────────────
export type TransactionType = "expense" | "income" | "transfer";

export interface Expense extends BaseRecord {
  name: string;
  amount: number;
  date: string;
  category: string;
  accountId: string;
  notes?: string;
  tags?: string[];
}

export interface Income extends BaseRecord {
  name: string;
  amount: number;
  date: string;
  accountId: string;
  category?: string;
  notes?: string;
}

export interface Transfer extends BaseRecord {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  notes?: string;
}

// ── Recurring items ───────────────────────────────────────────────────────────
export type Frequency = "daily" | "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly";

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

// ── Loans & amortisation ──────────────────────────────────────────────────────
export type LoanType = "normal" | "credit_card";

export interface Loan extends BaseRecord {
  name: string;
  loanType: LoanType;         // normal vs credit-card-linked (kept separate per FRD 4.4)
  principalAmount: number;
  interestRate: number;       // annual % rate
  tenureMonths: number;
  startDate: string;
  emi: number;                // calculated or overridden
  paidMonths: number;
  accountId: string;          // bank account EMI is debited from
  linkedCreditCardId?: string; // only for credit_card type
  notes?: string;
}

export interface AmortisationRow {
  month: number;
  date: string;
  openingBalance: number;
  emi: number;
  principal: number;
  interest: number;
  closingBalance: number;
  isPaid: boolean;
}

// ── Credit cards ──────────────────────────────────────────────────────────────
export interface CreditCard extends BaseRecord {
  name: string;
  limit: number;
  outstanding: number;        // current bill outstanding
  dueDate: string;
  statementDate: string;      // billing cycle start
  billingDay: number;
  notes?: string;
}

// ── Receivables (money lent) ──────────────────────────────────────────────────
export interface Receivable extends BaseRecord {
  personName: string;         // who owes money
  description?: string;
  amountLent: number;
  amountRepaid: number;       // running total of repayments
  dateLent: string;
  expectedRepaymentDate?: string;
  accountId: string;          // account money was sent from
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
  | "stocks" | "mutual_fund" | "ppf" | "fd" | "nps"
  | "crypto" | "real_estate" | "gold" | "other";

export interface Investment extends BaseRecord {
  name: string;
  value: number;              // current market value
  costBasis?: number;         // purchase cost
  type: InvestmentType;
  accountId?: string;
  notes?: string;
}

// ── Reconciliation ────────────────────────────────────────────────────────────
export type ReconciliationStatus = "pending" | "completed" | "in_progress";

export interface Reconciliation extends BaseRecord {
  accountId: string;
  reconciledDate: string;
  trackedBalance: number;     // what the app shows
  actualBalance: number;      // what the bank/statement shows
  difference: number;         // actualBalance - trackedBalance
  status: ReconciliationStatus;
  adjustmentTransactionId?: string; // if adjustment was recorded
  notes?: string;
}

// ── Financial Goals ───────────────────────────────────────────────────────────
export type GoalType = "savings" | "debt_payoff" | "investment" | "emergency_fund" | "purchase" | "custom";
export type GoalStatus = "active" | "completed" | "paused";

export interface Goal extends BaseRecord {
  name: string;
  type: GoalType;
  targetAmount: number;
  currentAmount: number;      // manually updated or linked account balance
  targetDate?: string;
  monthlyContribution?: number;
  linkedAccountId?: string;
  status: GoalStatus;
  notes?: string;
  icon?: string;              // emoji
}

// ── Double-entry ledger (underlying model) ────────────────────────────────────
export type LedgerAccountType = "asset" | "liability" | "income" | "expense" | "equity";

export interface LedgerEntry extends BaseRecord {
  transactionId: string;      // groups debit + credit pair
  accountId: string;
  amount: number;             // always positive; direction from entryType
  entryType: "debit" | "credit";
  description: string;
  date: string;
  sourceType: "expense" | "income" | "transfer" | "loan" | "adjustment" | "goal";
  sourceId: string;
}

// ── Sync / queue ──────────────────────────────────────────────────────────────
export type ChangeType = "create" | "update" | "delete";

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
  | "accounts" | "expenses" | "incomes" | "transfers"
  | "recurringPayments" | "recurringIncomes"
  | "loans" | "creditCards"
  | "receivables" | "repaymentRecords"
  | "investments" | "reconciliations" | "goals";

export type SyncStatus = "idle" | "firebase" | "rest";

export interface AppState {
  accounts:          Account[];
  expenses:          Expense[];
  incomes:           Income[];
  transfers:         Transfer[];
  recurringPayments: RecurringPayment[];
  recurringIncomes:  RecurringIncome[];
  loans:             Loan[];
  creditCards:       CreditCard[];
  receivables:       Receivable[];
  repaymentRecords:  RepaymentRecord[];
  investments:       Investment[];
  reconciliations:   Reconciliation[];
  goals:             Goal[];
  loading:           boolean;
  error:             string | null;
  syncStatus:        SyncStatus;
}

export type AppAction =
  | { type: "LOAD_ALL";      payload: Partial<AppState> }
  | { type: "SET_ERROR";     payload: string }
  | { type: "SET_SYNC";      payload: SyncStatus }
  | { type: "UPSERT";        payload: { entity: EntityName; record: BaseRecord } }
  | { type: "REMOVE";        payload: { entity: EntityName; id: string } }
  | { type: "RELOAD_ENTITY"; payload: { entity: EntityName; records: BaseRecord[] } };

// ── Forecast types ────────────────────────────────────────────────────────────
export interface ForecastEvent {
  date: string;
  label: string;
  amount: number;             // positive = inflow, negative = outflow
  type: "income" | "payment" | "emi" | "credit" | "goal_contribution";
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
}
