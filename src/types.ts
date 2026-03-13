// ─────────────────────────────────────────────────────────────────────────────
//  types.ts  –  All shared TypeScript interfaces & unions
// ─────────────────────────────────────────────────────────────────────────────

export interface BaseRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface Account extends BaseRecord {
  name: string;
  type: "bank" | "cash" | "wallet" | "credit";
  balance: number;
  color?: string;
}

export interface Expense extends BaseRecord {
  name: string;
  amount: number;
  date: string;
  category: string;
  accountId: string;
  notes?: string;
}

export type Frequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export interface Income extends BaseRecord {
  name: string;
  amount: number;
  frequency: Frequency;
  nextDate: string;
  accountId: string;
}

export interface RecurringPayment extends BaseRecord {
  name: string;
  amount: number;
  frequency: Frequency;
  nextDate: string;
  category: string;
  accountId: string;
}

export interface Loan extends BaseRecord {
  name: string;
  totalAmount: number;
  emi: number;
  tenure: number;
  paidMonths: number;
  startDate: string;
  accountId: string;
}

export interface CreditCard extends BaseRecord {
  name: string;
  limit: number;
  outstanding: number;
  dueDate: string;
  billingDay: number;
}

export type InvestmentType =
  | "stocks" | "mutual_fund" | "ppf" | "fd"
  | "crypto" | "real_estate" | "other";

export interface Investment extends BaseRecord {
  name: string;
  value: number;
  type: InvestmentType;
}

export type EntityName =
  | "accounts" | "expenses" | "incomes" | "recurringPayments"
  | "loans" | "creditCards" | "investments";

export type SyncStatus = "idle" | "firebase" | "rest";

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

export interface AppState {
  accounts: Account[];
  expenses: Expense[];
  incomes: Income[];
  recurringPayments: RecurringPayment[];
  loans: Loan[];
  creditCards: CreditCard[];
  investments: Investment[];
  loading: boolean;
  error: string | null;
  syncStatus: SyncStatus;
}

export type AppAction =
  | { type: "LOAD_ALL";      payload: Partial<AppState> }
  | { type: "SET_ERROR";     payload: string }
  | { type: "SET_SYNC";      payload: SyncStatus }
  | { type: "UPSERT";        payload: { entity: EntityName; record: BaseRecord } }
  | { type: "REMOVE";        payload: { entity: EntityName; id: string } }
  | { type: "RELOAD_ENTITY"; payload: { entity: EntityName; records: BaseRecord[] } };

export interface ForecastEvent {
  date: string;
  label: string;
  amount: number;
  type: "income" | "payment" | "emi" | "credit";
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
}

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}
