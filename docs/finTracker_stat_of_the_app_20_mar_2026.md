# FinTracker v4 — Application State Report

> **Version:** 4.0 &nbsp;|&nbsp; **Stack:** React 18 + TypeScript + Vite &nbsp;|&nbsp; **Storage:** IndexedDB v4 (offline-first) &nbsp;|&nbsp; **Sync:** Firebase Firestore (optional)

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Architecture](#2-architecture)
3. [Navigation & Shell](#3-navigation--shell)
4. [Data Model](#4-data-model)
5. [Chart of Accounts & AccountHead System](#5-chart-of-accounts--accounthead-system)
6. [Double-Entry Transaction Model](#6-double-entry-transaction-model)
7. [Balance Computation](#7-balance-computation)
8. [Entity Catalogue](#8-entity-catalogue)
9. [Views & User Interactions](#9-views--user-interactions)
10. [Forms & Inline Head Creation](#10-forms--inline-head-creation)
11. [Payments & Occurrences System](#11-payments--occurrences-system)
12. [Sync Architecture](#12-sync-architecture)
13. [PWA & Routing](#13-pwa--routing)
14. [Settings & Data Management](#14-settings--data-management)
15. [State Lifecycle](#15-state-lifecycle)
16. [Entity Interaction Map](#16-entity-interaction-map)
17. [Known Constraints & Design Decisions](#17-known-constraints--design-decisions)

---

## 1. Application Overview

FinTracker v4 is a **local-first, offline-capable personal finance PWA** designed for Indian users (amounts in ₹). All data is stored in the browser's IndexedDB and never leaves the device unless the user explicitly connects Firebase Firestore for cross-device sync.

The application implements a **strict double-entry bookkeeping model**: every economic event is recorded as a journal entry with an explicit debit account head and credit account head. Account balances are never stored—they are always computed from the journal entry history.

**Core design principles:**

- **Offline-first:** The app works fully without internet. Firebase sync is optional and additive.
- **Double-entry:** Every ₹ movement has two sides. No balance is stored; all balances are derived.
- **Unified chart of accounts:** Bank accounts, credit cards, and loans are account heads in the same hierarchy as income and expense categories.
- **No authentication:** Single-user, device-local. Sharing is handled by Firebase QR code pairing.
- **PWA:** Installable on iOS, Android, and desktop with home screen shortcuts.

---

## 2. Architecture

### Layer diagram

```
Browser
├── React 18 (UI layer)
│   ├── AppProvider (useReducer + context)
│   │   ├── AppState (14 entity arrays + computedBalances + sync)
│   │   └── Actions: save, remove, clearData, syncNow, connectFirebase
│   ├── Views (19 route destinations)
│   ├── Forms (JournalEntryForm, AccountForm, …)
│   └── Charts (Recharts)
│
├── Web Worker (balanceWorker.ts)
│   └── Receives accounts + accountHeads + journalEntries
│       Returns ComputedBalances (debounced 300 ms)
│
├── IndexedDB (fintracker_v4, version 4)
│   ├── 14 entity stores + syncQueue
│   └── BaseRepository<T> (typed CRUD)
│
└── SyncQueue (module-level singleton)
    ├── Enqueues changes → localStorage persistence
    └── FirebaseSyncAdapter
        ├── pushChanges() → writeBatch to Firestore
        ├── subscribeRealtime() → onSnapshot listeners
        └── clearCollections()
```

### Key files

| File | Role |
|---|---|
| `src/types.ts` | All TypeScript interfaces and constants |
| `src/context/AppContext.tsx` | Global state, reducer, save/remove with AccountHead mirroring |
| `src/db/indexedDB.ts` | IDB wrapper (openDB, dbGetAll, dbPut, dbDelete, dbClear) |
| `src/repositories/BaseRepository.ts` | Typed CRUD over IDB |
| `src/workers/balanceWorker.ts` | Off-thread double-entry balance calculation |
| `src/sync/syncQueue.ts` | Change queue, flush, onFlushResult callback |
| `src/sync/FirebaseSyncAdapter.ts` | Firestore push/pull/realtime |
| `src/utils/recurring.ts` | Payment occurrence generation |
| `src/utils/forecast.ts` | 60-day cash-flow forecast |
| `src/utils/importEngine.ts` | JSON import parser with duplicate detection |
| `src/App.tsx` | Hash router, nav config, shell layout |

### Technology stack

| Concern | Library |
|---|---|
| UI framework | React 18 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS (dark theme, `bg #07090f`) |
| Component base | Radix UI primitives (shadcn pattern) |
| Charts | Recharts |
| Date math | date-fns |
| Icons | Lucide React |
| Fonts | DM Sans (body), JetBrains Mono (numbers), Syne (display) |
| Offline DB | IndexedDB (custom wrapper, no Dexie) |
| Cloud sync | Firebase JS SDK v10 (Firestore) |
| PWA | Custom service worker (network-first nav, cache-first assets) |

---

## 3. Navigation & Shell

### Layout

On **desktop (≥ md breakpoint):** a fixed 240px left sidebar is always visible. The main content area fills the remaining width, max-width 672px centered.

On **mobile:** the sidebar is hidden. A sticky top header shows the current page name. A bottom navigation bar shows five shortcuts. A "More" button slides in a full-height drawer with the complete navigation tree.

### Routing

The app uses **hash-based routing** (`/#/dashboard`, `/#/expenses`, etc.) implemented without any router library. A `useHashRouter` hook reads `window.location.hash` on mount, listens to `hashchange` events for back/forward navigation, and pushes new hashes via `window.location.hash = "/${id}"`. Unrecognised hashes fall back to `dashboard`.

Nav links are `<a href="#/...">` elements (not buttons) so right-click → "Open in new tab" works correctly.

### Navigation tree

**Ungrouped (top of sidebar):**

| Route | Label | Icon |
|---|---|---|
| `/#/dashboard` | Dashboard | LayoutDashboard |
| `/#/payments` | Payments | CalendarCheck |
| `/#/forecast` | Forecast | TrendingUp |
| `/#/simulator` | Simulator | Sliders |

**Money group:**

| Route | Label |
|---|---|
| `/#/expenses` | Expenses |
| `/#/income` | Income |
| `/#/transfers` | Transfers |
| `/#/recurring` | Recurring |
| `/#/ledger` | Account Book |
| `/#/journalledger` | Journal Ledger |

**Accounts group:**

| Route | Label |
|---|---|
| `/#/accounts` | Accounts |
| `/#/loans` | Loans & EMIs |
| `/#/cards` | Credit Cards |
| `/#/receivables` | Money Lent |
| `/#/investments` | Investments |

**Planning group:**

| Route | Label |
|---|---|
| `/#/goals` | Goals |
| `/#/reconciliation` | Reconciliation |
| `/#/accountheads` | Account Heads |

**Bottom of sidebar (ungrouped):**

| Route | Label |
|---|---|
| `/#/settings` | Settings |

**Mobile bottom nav (5 shortcuts + More):**
Dashboard · Payments · Expenses · Accounts · Forecast · More

### Sidebar status indicator

The bottom of the sidebar shows a pulsing green dot when Firebase sync is active ("Firebase live") or a grey dot when offline ("Local only").

---

## 4. Data Model

### AppState shape

```typescript
interface AppState {
  accounts:           Account[];
  accountHeads:       AccountHead[];
  journalEntries:     JournalEntry[];
  recurringPayments:  RecurringPayment[];
  recurringIncomes:   RecurringIncome[];
  loans:              Loan[];
  creditCards:        CreditCard[];
  receivables:        Receivable[];
  repaymentRecords:   RepaymentRecord[];
  investments:        Investment[];
  reconciliations:    Reconciliation[];
  goals:              Goal[];
  paymentOccurrences: PaymentOccurrence[];
  importReviews:      ImportReview[];
  computedBalances:   ComputedBalances;   // derived, never stored
  loading:            boolean;
  error:              string | null;
  syncStatus:         SyncStatus;         // "idle" | "firebase" | "rest"
  sync:               SyncState;          // detailed sync telemetry
}
```

`computedBalances` is a `Record<accountId, number>` that is **never persisted to IndexedDB**. It is recomputed by the balance worker every time `accounts`, `accountHeads`, or `journalEntries` change.

### IndexedDB schema (v4)

Database name: `fintracker_v4`, current version: **4**

| Store | Key | Indexes |
|---|---|---|
| `accounts` | `id` | — |
| `accountHeads` | `id` | type, parentId, isAccount |
| `journalEntries` | `id` | date, type, debitAccountHeadId, creditAccountHeadId |
| `recurringPayments` | `id` | nextDate, accountId |
| `recurringIncomes` | `id` | nextDate, accountId |
| `loans` | `id` | accountId, loanType |
| `creditCards` | `id` | — |
| `receivables` | `id` | accountId |
| `repaymentRecords` | `id` | receivableId, date |
| `investments` | `id` | type |
| `reconciliations` | `id` | accountId, reconciledDate |
| `goals` | `id` | type, status |
| `paymentOccurrences` | `id` | dueDate, sourceId, status, kind |
| `importReviews` | `id` | sessionId, status, entity |
| `syncQueue` | `queueId` | entity |

### Migration history

- **v1 → v2:** Added `paymentOccurrences` store, `PaymentOccurrence.transactionId` field
- **v2 → v3:** Added `accountHeads`, `importReviews` stores; migrated `account.balance → account.openingBalance`; cleared `expenses`, `incomes`, `transfers` stores
- **v3 → v4:** Added `journalEntries` store (replaces expenses/incomes/transfers); old stores preserved in schema but unused

---

## 5. Chart of Accounts & AccountHead System

### Five root heads (immutable)

| ID | Name | Type | Behaviour |
|---|---|---|---|
| `head_asset` | Assets | asset | Bank accounts, cash, investments, receivables live here |
| `head_liability` | Liabilities | liability | Credit cards, loans live here |
| `head_income` | Income | income | Income sub-heads (Salary, Freelance, etc.) |
| `head_expense` | Expenses | expense | Expense sub-heads (Food, Bills, Netflix, etc.) |
| `head_equity` | Equity | equity | Opening balances, adjustment entries |

Root heads have `parentId: null` and `isSystem: true`. They cannot be deleted or renamed.

### User-defined sub-heads

Users can create sub-heads under any root through:
1. The **Account Heads** view (Settings → Planning → Account Heads)
2. **Inline creation** in any form's account head selector (shows "+ New under [Parent]…" option)

Sub-heads have `parentId` set to the root head's ID. They can have children (two levels supported in the UI). A sub-head can only be deleted if no journal entries reference it and it has no children.

### Account-head mirroring (unified model)

**Every `Account`, `CreditCard`, and `Loan` is simultaneously an `AccountHead` with the same `id`.** This is the core of the unified chart of accounts.

When `save("accounts", ...)` is called in `AppContext`:
1. The account is saved to the `accounts` IDB store
2. An `AccountHead` record is immediately constructed with `isAccount: true` and saved to `accountHeads`
3. Both entities are dispatched to React state

The `AccountHead` type maps from account type as follows:

| Account type | AccountHead type | Parent head |
|---|---|---|
| bank | asset | head_asset |
| cash | asset | head_asset |
| investment | asset | head_asset |
| receivable | asset | head_asset |
| credit_card | liability | head_liability |
| loan | liability | head_liability |

When `remove("accounts", id)` is called, both the `Account` and its mirror `AccountHead` are deleted atomically.

The `isAccount: true` flag on the `AccountHead` prevents it from appearing in the user-managed head list and prevents deletion through the AccountHeads UI (the underlying account must be deleted instead).

---

## 6. Double-Entry Transaction Model

### The JournalEntry

Every financial event—expense, income, transfer, loan EMI, reconciliation adjustment, opening balance—is stored as a single `JournalEntry`:

```typescript
interface JournalEntry {
  id:                  string;
  date:                string;        // yyyy-MM-dd
  description:         string;
  amount:              number;        // always positive
  type:                JournalEntryType;
  debitAccountHeadId:  string;        // Dr side
  creditAccountHeadId: string;        // Cr side
  notes?:              string;
  tags?:               string[];
  createdAt:           string;
  updatedAt:           string;
}
```

`JournalEntryType` values: `"expense" | "income" | "transfer" | "emi" | "adjustment" | "opening_balance"`

### Accounting rules (normal balances)

| Account type | Increases on | Decreases on |
|---|---|---|
| Asset | Debit (Dr) | Credit (Cr) |
| Expense | Debit (Dr) | Credit (Cr) |
| Income | Credit (Cr) | Debit (Dr) |
| Liability | Credit (Cr) | Debit (Dr) |
| Equity | Credit (Cr) | Debit (Dr) |

### Transaction examples

**Expense — Netflix ₹649 from HDFC Savings:**
```
Dr: Expenses → Netflix     ₹649
Cr: Assets → HDFC Savings  ₹649
```
`debitAccountHeadId` = id of "Netflix" sub-head  
`creditAccountHeadId` = id of HDFC Savings account (same as account id)

**Income — Salary ₹85,000 into HDFC Savings:**
```
Dr: Assets → HDFC Savings  ₹85,000
Cr: Income → Salary         ₹85,000
```

**Transfer — ₹10,000 from HDFC to ICICI:**
```
Dr: Assets → ICICI Savings  ₹10,000
Cr: Assets → HDFC Savings   ₹10,000
```
Both account heads here are real accounts (asset mirrors).

**Reconciliation adjustment — actual balance ₹500 higher than tracked:**
```
Dr: Assets → HDFC Savings  ₹500
Cr: Equity                  ₹500
```
(Opposite entries if actual is lower.)

**Loan EMI payment — ₹25,000 from HDFC:**
```
Dr: Liabilities → Home Loan   ₹25,000
Cr: Assets → HDFC Savings     ₹25,000
```

---

## 7. Balance Computation

### Overview

Account balances are **never stored**. They are computed on demand by a Web Worker (`src/workers/balanceWorker.ts`) that receives the full `accounts`, `accountHeads`, and `journalEntries` arrays, processes every entry applying double-entry rules, and returns a `ComputedBalances` map (`Record<accountId, number>`).

### Trigger mechanism (debounced)

In `AppContext`, a `useEffect` watches `[state.accounts, state.accountHeads, state.journalEntries, state.loading]`. When any of these arrays change reference, it calls `triggerBalance()` which:
1. Cancels any pending debounce timer
2. Sets a 300ms `setTimeout`
3. On expiry, reads the **latest** state from `stateRef.current` (avoiding stale closures)
4. Posts `{ accounts, accountHeads, journalEntries }` to the worker

The 300ms debounce means a bulk import of 100 entries results in **one** computation rather than 100.

### Worker algorithm

```
for each account:
  balances[account.id] = account.openingBalance

for each journalEntry:
  debit side (debitAccountHeadId):
    if this id is a real account:
      rootType = walk parentId chain to find root type
      if rootType in ["asset", "expense"]:
        balances[debitId] += amount   // debit increases asset/expense
      else:
        balances[debitId] -= amount   // debit decreases liability/income

  credit side (creditAccountHeadId):
    if this id is a real account:
      if rootType in ["asset", "expense"]:
        balances[creditId] -= amount  // credit decreases asset/expense
      else:
        balances[creditId] += amount  // credit increases liability/income
```

### Fallback

If `new Worker(...)` throws (some browser contexts, certain extensions), `computeBalances()` is called synchronously on the main thread instead. The result is identical.

### Usage

All views read balance from `state.computedBalances[account.id]` and fall back to `account.openingBalance ?? 0` if the worker hasn't returned yet (e.g., on first load).

---

## 8. Entity Catalogue

### 8.1 Account

Represents a financial account held by the user.

| Field | Type | Notes |
|---|---|---|
| id | string | UUID; also the `AccountHead.id` for this account |
| name | string | Display name (e.g., "HDFC Savings") |
| type | AccountType | bank / cash / credit_card / loan / investment / receivable |
| openingBalance | number | Balance before any recorded journal entries |
| color | string | Hex colour for UI display (8 presets available) |
| currency | string | Default "INR" |
| notes | string? | Free text |
| isArchived | boolean? | Soft-delete flag (UI not yet filtering on this) |

**Lifecycle:** Creating an account immediately creates a mirror `AccountHead`. Deleting an account deletes the mirror. The account's `id` is used as `creditAccountHeadId` or `debitAccountHeadId` in journal entries involving this account.

### 8.2 AccountHead

Node in the chart of accounts tree.

| Field | Type | Notes |
|---|---|---|
| id | string | For root heads: fixed constants (head_asset, etc.) |
| name | string | Display name |
| type | RootAccountHeadType | asset / liability / income / expense / equity |
| parentId | string \| null | null = root node |
| isSystem | boolean | true = root head, cannot delete |
| isAccount | boolean? | true = auto-mirror of Account/CreditCard/Loan |
| notes | string? | Free text |

### 8.3 JournalEntry

The fundamental transaction record.

| Field | Type | Notes |
|---|---|---|
| id | string | UUID |
| date | string | yyyy-MM-dd |
| description | string | Human-readable description |
| amount | number | Always positive |
| type | JournalEntryType | expense / income / transfer / emi / adjustment / opening_balance |
| debitAccountHeadId | string | Dr side account head id |
| creditAccountHeadId | string | Cr side account head id |
| notes | string? | Free text |
| tags | string[]? | Optional tags |

### 8.4 RecurringPayment

A recurring bill or scheduled payment.

| Field | Type | Notes |
|---|---|---|
| name | string | e.g., "Netflix", "Rent" |
| amount | number | Expected amount |
| frequency | Frequency | daily / weekly / fortnightly / monthly / quarterly / yearly |
| nextDate | string | Next due date; advances on mark-paid |
| category | string | Legacy category label |
| accountId | string | Default credit account (bank to pay from) |
| debitAccountHeadId | string? | Pre-set expense head (e.g., "Bills → Netflix") |
| isActive | boolean | Paused items excluded from PaymentsView |

**Mark-paid flow:** When paid, `debitAccountHeadId` is shown read-only in the pay dialog. The user selects which account to pay from (credit side). A `JournalEntry` is created. `nextDate` is advanced by one frequency period.

### 8.5 RecurringIncome

Scheduled income (salary, rental, etc.).

| Field | Type | Notes |
|---|---|---|
| name | string | e.g., "Salary" |
| amount | number | Expected amount |
| frequency | Frequency | Same values as RecurringPayment |
| nextDate | string | Next receipt date |
| accountId | string | Account to credit |

### 8.6 PaymentOccurrence

A single scheduled instance of a recurring payment, loan EMI, or credit card bill within a calendar month.

| Field | Type | Notes |
|---|---|---|
| id | string | Deterministic: `occ_${sourceId}_${dueDate}` |
| kind | PaymentOccurrenceKind | recurring_payment / recurring_income / loan_emi / credit_card_bill |
| sourceId | string | id of the RecurringPayment, Loan, or CreditCard |
| dueDate | string | yyyy-MM-dd |
| amount | number | Expected amount |
| status | PaymentOccurrenceStatus | unpaid / paid / skipped |
| paidDate | string? | Actual payment date |
| paidAmount | number? | Actual amount paid (may differ from expected) |
| transactionId | string? | id of the JournalEntry created on mark-paid |
| accountId | string? | Account used for payment |
| debitAccountHeadId | string? | Pre-filled expense head for pay dialog |

Occurrences are generated on-the-fly from source entities each time the PaymentsView renders for a given month. Newly generated occurrences are auto-saved to IDB. Stored occurrences (with `status = paid`) override generated ones.

### 8.7 Loan

| Field | Type | Notes |
|---|---|---|
| name | string | e.g., "Home Loan — SBI" |
| loanType | LoanType | normal / credit_card |
| principalAmount | number | Original loan amount |
| interestRate | number | Annual % (pre-tax) |
| tenureMonths | number | Total repayment period |
| startDate | string | First EMI date |
| emi | number | Monthly instalment (auto-calculated or overridden) |
| paidMonths | number | How many EMIs have been paid |
| accountId | string | Bank account EMI debits from |
| taxRate | number? | GST % on interest (e.g., 18) |
| taxIncludedInRate | boolean? | If true, interestRate already includes tax |

Saving a loan creates a mirror `AccountHead` under `head_liability`. The amortisation schedule is computed on-demand by `generateAmortisation()`.

### 8.8 CreditCard

| Field | Type | Notes |
|---|---|---|
| name | string | e.g., "HDFC Regalia" |
| limit | number | Credit limit |
| outstanding | number | Current statement balance |
| statementDay | number | Day of month statement generates (1–28) |
| billingCycleDays | number | Length of billing cycle (typically 30) |
| gracePeriodDays | number | Days after statement to pay |
| dueDate | string | Next payment due date (computed) |
| statementDate | string | Next statement date (computed) |
| taxRate | number? | GST % on interest charges |

Saving a credit card creates a mirror `AccountHead` under `head_liability`.

### 8.9 Receivable

Money lent to another person.

| Field | Type | Notes |
|---|---|---|
| personName | string | Who owes money |
| amountLent | number | Original amount |
| amountRepaid | number | Running total of repayments received |
| dateLent | string | Date of lending |
| expectedRepaymentDate | string? | Expected return date |
| accountId | string | Account money was sent from |
| isSettled | boolean | True when fully repaid |

Repayment records are child entities linked by `receivableId`.

### 8.10 Investment

| Field | Type | Notes |
|---|---|---|
| name | string | e.g., "Zerodha Portfolio" |
| value | number | Current market value |
| costBasis | number? | Purchase cost |
| type | InvestmentType | stocks / mutual_fund / ppf / fd / nps / crypto / real_estate / gold / other |
| accountId | string? | Linked account (optional) |

### 8.11 Reconciliation

Record of a balance reconciliation event.

| Field | Type | Notes |
|---|---|---|
| accountId | string | Account being reconciled |
| reconciledDate | string | Date of reconciliation |
| trackedBalance | number | What the app showed |
| actualBalance | number | What the bank statement showed |
| difference | number | actualBalance - trackedBalance |
| status | ReconciliationStatus | pending / completed / in_progress |
| adjustmentTransactionId | string? | JournalEntry id of the adjustment entry |

If `difference ≠ 0`, a double-entry `JournalEntry` of type `"adjustment"` is automatically created:
- Positive difference (actual higher): Dr account head, Cr `head_equity`
- Negative difference (actual lower): Dr `head_equity`, Cr account head

### 8.12 Goal

| Field | Type | Notes |
|---|---|---|
| name | string | e.g., "Emergency Fund" |
| type | GoalType | savings / debt_payoff / investment / emergency_fund / purchase / custom |
| targetAmount | number | Target value |
| currentAmount | number | Current progress |
| targetDate | string? | Deadline |
| monthlyContribution | number? | Used in forecast calculations |
| linkedAccountId | string? | For balance-linked goals |
| status | GoalStatus | active / completed / paused |
| icon | string | Emoji icon (auto-set from type) |

### 8.13 ImportReview

Pending duplicate decision from an import session.

| Field | Type | Notes |
|---|---|---|
| sessionId | string | Groups all reviews from one import run |
| entity | EntityName | Which entity the duplicate belongs to |
| incoming | Record | The record from the import file |
| existing | Record | The matched existing record |
| status | ImportReviewStatus | pending / resolved |
| decision | ImportReviewDecision? | skip / overwrite / create_new |

### 8.14 SyncState

Live sync telemetry (held in `AppState.sync`, never persisted).

| Field | Notes |
|---|---|
| status | "idle" / "firebase" / "rest" — which adapter is connected |
| phase | "idle" / "syncing" / "success" / "error" — current operation state |
| pendingCount | Local changes not yet pushed to cloud |
| lastSyncedAt | ISO timestamp of last successful flush |
| lastSyncedCount | Number of records pushed in last flush |
| lastError | Error message from last failed flush, or null |

---

## 9. Views & User Interactions

### 9.1 Dashboard (`/#/dashboard`)

**Purpose:** High-level financial snapshot.

**Stat cards (top row):**
- Total Balance — sum of `computedBalances` for all non-liability accounts
- Safe to Spend — `totalBalance - monthlyObligations × 1.5`
- Monthly Out — sum of active recurring payment amounts + loan EMI totalPayables
- Next Income — next recurring income amount and name

**Widgets:**
- Forecast Chart (60-day area chart from `buildForecast()`)
- Shortfall alert banner if any day in the 60-day horizon goes negative
- Overdue payments this month (from `getOccurrencesForMonth()`)
- Upcoming payments this month
- Spending Breakdown (donut chart + bar breakdown by debit account head name)
- Monthly Spending (bar chart, last 6 months, from `journalEntries` filtered to `type=expense`)
- Net Worth Trend (line chart, approximate 6-month trajectory)
- Receivables outstanding
- Financial Stress Score (debt / (balance + investments) as a percentage)
- Mini accounts list (all accounts with `computedBalances`)

### 9.2 Expenses (`/#/expenses`)

Filtered view of `journalEntries` where `type === "expense"`.

**Layout:**
- Category filter pills (derived from debit account head names)
- Monthly bars chart (last 6 months)
- Spending breakdown by category with progress bars
- Entry list sorted newest-first
- Each card shows: description, debit head, credit head (account), date, amount in red

**Add entry:** Opens `JournalEntryForm` with `defaultType="expense"`. Debit side selector filtered to expense-type heads. Credit side selector filtered to asset-type heads (accounts). Both sides support inline head creation.

**Edit/Delete:** Each card has a row actions menu (edit opens pre-filled form; delete removes the entry and triggers balance recomputation).

### 9.3 Income (`/#/income`)

Split into two tabs:

**Recurring tab:** Lists `recurringIncomes` with frequency badge, next date, and amount. Add/Edit/Delete each.

**One-off tab:** `journalEntries` where `type === "income"`, newest-first. Each shows debit head (the account), credit head (income sub-head), date.

### 9.4 Transfers (`/#/transfers`)

`journalEntries` where `type === "transfer"`, newest-first. Each card shows:
- Source account name (credit head) → Destination account name (debit head)
- Amount, date

Both sides in a transfer are asset account heads.

### 9.5 Recurring (`/#/recurring`)

Lists all `recurringPayments` with:
- Name, amount, frequency badge, next due date
- Active/paused status
- Category
- Edit and Delete actions

### 9.6 Account Book (`/#/ledger`) and Journal Ledger (`/#/journalledger`)

Both routes render `JournalLedgerView` (the same component). The "ledger" route is the legacy tab entry; "journalledger" is the explicit Journal Ledger nav item.

**JournalLedgerView features:**
- Entries sorted **oldest to newest** (ascending date)
- Grouped by date with a day-header row showing the net change for that day
- Three-column totals strip: Total In / Total Out / Net
- Each row shows: type icon, description, Dr head, Cr head, debit amount, credit amount, running balance
- Tap any row to expand inline details (type, amounts, both heads, notes, tags)

**Filters panel (toggle):**
- Type: All / Expense / Income / Transfer / EMI / Adjustment
- Account Head: dropdown of all non-root heads
- Date From / Date To
- Min Amount / Max Amount
- Natural language search (matches description, notes, debit head name, credit head name)

Active filter count shown as a badge on the filter button. "Clear all filters" link when any filter is active.

**When opened via account head (from AccountLedger):** `filterAccountHeadId` prop pre-filters all entries where `debitAccountHeadId === id OR creditAccountHeadId === id`. The running balance column is computed relative to that account head (debits +, credits −, adjusted for account type).

### 9.7 Accounts (`/#/accounts`)

List of all `accounts`. Total balance in subtitle = `Object.values(computedBalances).reduce(sum)`.

Each account card shows:
- Colour dot, name, type badge
- Computed balance from `computedBalances[a.id]` (cyan)
- Reconcile button (⚖️ icon) — opens `ReconciliationForm`
- Edit / Delete row actions
- Tap anywhere on the card → opens `AccountLedgerDialog`

**AccountLedgerDialog:** Full-height modal with header showing account name, type badge, and computed balance. Body contains `JournalLedgerView` pre-filtered to this account's id.

**EntityView "Add" button:** Opens `AccountForm`. On save, the account and its mirror AccountHead are created atomically.

**Reconciliation:** `ReconciliationForm` shows current computed balance as "tracked balance". User enters the actual bank statement balance. If there is a difference, a double-entry adjustment `JournalEntry` is created, and a `Reconciliation` record is saved.

### 9.8 Loans & EMIs (`/#/loans`)

Each loan card shows:
- Name, type badge
- Principal, interest rate, tenure
- EMI amount
- Months paid / total months
- Next EMI date
- Progress bar (paidMonths / tenureMonths)
- View Ledger button → `LoanLedgerDialog` (JournalLedgerView filtered to loan id)
- View Amortisation button → full amortisation schedule dialog

Amortisation schedule table shows: month number, date, opening balance, EMI, principal component, interest component, tax component, total payable, closing balance, paid status.

### 9.9 Credit Cards (`/#/cards`)

Each card shows:
- Card name
- Limit, outstanding, available credit
- Utilisation progress bar
- Statement date, due date
- View Ledger button → `CreditCardLedgerDialog`
- Edit / Delete

### 9.10 Money Lent (`/#/receivables`)

Each receivable shows:
- Person name, description
- Amount lent, amount repaid, amount outstanding
- Date lent, expected repayment date
- Settled badge if `isSettled: true`
- Record Repayment button → `RepaymentForm`
- Edit / Delete

### 9.11 Investments (`/#/investments`)

Each investment shows:
- Name, type badge
- Current value
- Cost basis (if set) and unrealised gain/loss
- Portfolio donut chart (by investment type)

### 9.12 Payments (`/#/payments`)

The central bill-tracking view. Shows all payment occurrences for the selected calendar month.

**Month navigator:** Previous / Current month label / Next arrows. "Current Month" label shown when viewing the present month.

**Month summary strip:** 4 columns: Total Out, Paid, Unpaid, and either Overdue or Income depending on context.

**Sections:**
- Overdue (unpaid past due date, red styling)
- Upcoming (unpaid future due dates)
- Paid
- Skipped
- Expected Income (recurring incomes for this month)

**Occurrence card:** Shows label, category badge, urgency label ("Due in 3d", "Overdue by 2d"), due date, amount. For paid occurrences: paid account with colour dot, actual paid amount (if different from expected).

**Action buttons per card:**
- "Mark Paid" / "Mark Received" → opens PayDialog
- "Skip" → marks occurrence as skipped, advances `nextDate` on source
- "Undo" → reverts to unpaid, deletes the linked JournalEntry

**PayDialog:**
- Shows occurrence label and due date
- Shows debit head (read-only, from `occ.debitAccountHeadId` or recurring payment's default)
- Payment date picker (defaults to today)
- Amount field (pre-filled with expected, editable)
- Account selector (credit side — which account to pay from)
- Balance preview: "Balance after: ₹X" shown below account selector
- Shortfall detection: if account balance < amount, shows warning with inline top-up toggle
  - Top-up creates a separate income JournalEntry (Dr account, Cr head_equity) before the main payment
- "Confirm Payment" creates a JournalEntry, marks occurrence paid, advances nextDate, increments paidMonths for loan EMIs

**Occurrence ID generation:** Deterministic — `occ_${sourceId}_${dueDate}` — so the same occurrence is always referenced correctly even if the auto-save hasn't completed.

### 9.13 Forecast (`/#/forecast`)

60-day forward cash-flow projection from `buildForecast()`.

Shows:
- Area chart of projected balance (blue if positive, red if shortfall exists)
- Timeline cards — one per day that has events — showing:
  - Date
  - Events (income +, payment −, EMI −, CC bill −, goal contribution −)
  - Projected balance after all events
- Shortfall alert card at the top if balance ever goes negative within 60 days

### 9.14 Simulator (`/#/simulator`)

Three simulation calculators in tabs:

**Loan Simulator:** Enter principal, rate, tenure → shows computed EMI, total interest, total cost, and whether current balance can service it.

**Purchase Simulator:** Enter purchase amount → shows impact on months of runway (balance / monthly obligations).

**Recurring Simulator:** Enter recurring expense amount → shows new monthly total and its percentage of balance.

### 9.15 Reconciliation (`/#/reconciliation`)

Lists all `Reconciliation` records, newest-first. Each shows:
- Account name, date, tracked balance, actual balance, difference
- Status badge
- Linked adjustment transaction id (if any)

Primary entry point is via the Reconcile button on the Accounts view.

### 9.16 Goals (`/#/goals`)

Each goal card shows:
- Icon + name + type badge + status
- Progress bar (currentAmount / targetAmount)
- Target amount, current amount, percentage
- Projected completion date (if monthlyContribution set)
- Linked account balance (if linkedAccountId set)
- Edit / Delete

### 9.17 Account Heads (`/#/accountheads`)

Displays the full chart of accounts tree. Root heads shown with bold uppercase labels. Children indented with └ prefix.

For each user-created (non-system, non-account-mirror) sub-head:
- Delete button (enabled only if no journal entries reference it AND no children)

**Add account head panel:**
- Name field
- Parent selector (root heads only)
- Create button

**View Ledger:** Each head (including root heads) has a "View Ledger" action that opens `AccountHeadLedgerDialog` showing all journal entries for that head.

### 9.18 Settings (`/#/settings`)

Four-tab panel:

**Import / Export tab:**
- Export all data as JSON
- Download sample import JSON
- Import from JSON (triggers full parse pipeline)

**Merge tab (Merge Accounts):**
- Select "keep" account and "delete" account
- Re-points all journal entry debit/credit references, recurring payment accounts, loan accounts, receivable accounts from deleted to kept account
- Deletes the duplicate account (and its AccountHead mirror)

**Dups tab (Duplicate Review):**
- Lists pending `ImportReview` records (transaction duplicates from a previous import)
- Badge count shown on tab
- Each card: description, date, amount, options: Skip / Overwrite / Create New

**Clear Data tab:**
- Checkbox selection of entity groups to clear
- Scope selector: Local device only / Cloud (Firestore) only / Local + Cloud
- Cloud options disabled with tooltip if Firebase not connected
- "Clear [selected]" button → opens confirmation dialog
- Confirmation dialog shows exact summary + "Type DELETE to confirm" gate
- On confirm: `dbClear()` per entity + `dbClear("syncQueue")` + re-seeds account heads if needed

**Firebase Sync card (below tabs):**
- When disconnected: Firebase setup form (paste SDK snippet or manual fields)
- When connected:
  - 3-column status grid: Status / Pending changes / Last sync time
  - Last error panel (red, shown only on error)
  - "Sync Now" button (spins during sync, shows phase)
  - "QR Code" button → generates QR with base64-encoded Firebase config for mobile pairing
  - "Disconnect" button

**Install as App card:** Instructions for iOS Safari, Android Chrome, desktop browsers.

**Data Summary card:** Count of each entity type.

---

## 10. Forms & Inline Head Creation

### JournalEntryForm

Used for expenses, income, and transfers (with `defaultType` prop setting the semantic meaning).

Fields:
- Description (text)
- Amount (number)
- Date (date picker, defaults to today)
- Debit head selector (filtered by type based on `defaultType`)
- Credit head selector (filtered by type based on `defaultType`)
- Notes (text)

For expenses: debit selector shows expense-type heads; credit shows asset-type heads.
For income: debit shows asset-type; credit shows income-type.
For transfers: both sides show asset-type.

If `lockedDebitId` or `lockedCreditId` props are passed, that side renders as a read-only display (used in PayDialog).

### HeadSelect (inline head creation)

The `HeadSelect` component is used in all head selectors. It renders:
- Root heads as bold selectable items
- Children of each root indented with └
- "New under [Root Name]…" option at the bottom of each root's section with a + icon

Selecting the "New under…" option opens `CreateHeadDialog`:
- Name field (auto-focused, Enter submits)
- Creates the AccountHead via `save("accountHeads", ...)`
- Immediately selects the new head in the parent form (no form reset needed)

This inline creation is available in:
- `ExpenseForm` (debit head)
- `IncomeForm` (credit head)
- `TransferForm` (both heads)
- `RecurringPaymentForm` (debit head)

### AccountForm

Fields: Name, Type (dropdown), Opening Balance (₹), Colour (8 colour swatches), Notes.

Opening balance represents the account's value before any journal entries. It seeds the balance worker.

---

## 11. Payments & Occurrences System

### Occurrence generation

`getOccurrencesForMonth(state, year, month)` is called on every render of `PaymentsView` for the selected month. It:

1. Builds an index of stored occurrences by deterministic id
2. For each active `RecurringPayment`: calls `projectDatesInMonth()` which walks forward and backward from `nextDate` to find all dates in the target month for that frequency
3. For each active `RecurringIncome`: same projection
4. For each `Loan`: generates the full amortisation schedule, finds rows whose date falls in the target month
5. For each `CreditCard`: checks if `dueDate` falls in the target month

For each projected occurrence:
- If a stored occurrence with the same deterministic id exists → use the stored version (preserves paid/skipped status)
- Otherwise → create a new occurrence object with `status: "unpaid"`

Results are sorted by `dueDate`.

### Auto-save

New occurrences (not yet in IDB) are auto-saved in a `useEffect` that watches `allOccs.length`. This prevents re-creating the same occurrence across renders.

### Frequency advancement

When a recurring payment/income is marked paid, `advanceByFrequency(src.nextDate, src.frequency)` is called to set the next due date. This only advances if `occ.dueDate >= src.nextDate` (prevents double-advancement if paying past occurrences).

---

## 12. Sync Architecture

### SyncQueue (module singleton)

`syncQueue.ts` maintains a module-level `_adapter` variable. All change operations flow through:

1. `save()` in `AppContext` writes to IDB and dispatches to React state
2. `BaseRepository.save()` calls `enqueueChange()` which writes a `ChangeRecord` to the `syncQueue` IDB store and immediately calls `flush()`
3. `flush()` reads all unsynced changes from `syncQueue`, calls `adapter.pushChanges(changes)`, and marks each successfully synced change with `syncedAt`
4. After every flush (success or error), `_onFlush` callback fires, which `AppContext` uses to update `state.sync`

### FirebaseSyncAdapter

**Setup:** `initializeApp()` / `getFirestore()` called once on `prepare()`. Idempotent.

**Push:** Uses `writeBatch()`. Each `ChangeRecord` is either a `batch.set(..., { merge: true })` or `batch.delete()`. Firestore batch limit is 500 ops; `clearCollections()` chunks accordingly.

**Pull (realtime):** `subscribeRealtime()` calls `onSnapshot()` on every entity collection. On each snapshot change:
- `removed` → `dbDelete(entity, doc.id)` then `onReload(entity)`
- `added/modified` → `dbPut(entity, doc.data())` then `onReload(entity)`
- `reloadEntity()` fetches the full store from IDB and dispatches `RELOAD_ENTITY`

**QR sync pairing:** When user taps "QR Code", the Firebase config is base64-encoded and embedded in `?fbc=` query param URL, displayed as a QR code. On the mobile device, scanning opens the URL; `AppContext` reads the `?fbc=` param, decodes the config, connects Firebase, and removes the param from the URL.

**Manual sync (`syncNow`):** Sets `phase: "syncing"`, calls `flush()`, updates `sync` state via `onFlushResult` callback. The spinner on the "Sync Now" button reflects `sync.phase === "syncing"`.

**Pending count:** After every `save()`, `getPendingCount()` reads the `syncQueue` store and counts unsynced records. This updates `sync.pendingCount` in real time.

---

## 13. PWA & Routing

### Service Worker (`public/sw.js`)

- **Navigation requests (HTML):** Network-first. Falls back to cache if offline.
- **Fingerprinted assets (JS/CSS with hash):** Cache-first. Never stale (hash changes on every build).
- **Cache name:** Injected at build time by Vite plugin (`injectSwVersion`) to ensure stale caches are purged on every deploy.
- **Update detection:** Service worker `updatefound` event triggers a skip-waiting call, and `controllerchange` reloads the page to pick up the new version.

### Web App Manifest (`public/manifest.json`)

- `start_url`: `/#/dashboard`
- `display`: `standalone`
- Theme: `#07090f` (deep dark navy)
- Icons: 192px and 512px PNG (both `any` and `maskable` variants)
- Shortcuts: Add Expense (`/#/expenses`), Dashboard (`/#/dashboard`), Payments (`/#/payments`)

### Hash routing and PWA compatibility

Hash-based routing (`/#/route`) works with any static host (GitHub Pages, Netlify, Vercel) without server-side rewrite rules, and is fully compatible with the service worker's navigation-first strategy since the path before the hash is always `/index.html`.

---

## 14. Settings & Data Management

### Export

All 14 entity stores are exported as a JSON file:
```json
{
  "version": "4.0",
  "exportedAt": "2026-03-20T...",
  "data": {
    "accounts": [...],
    "accountHeads": [...],
    "journalEntries": [...],
    ...
  }
}
```

### Import

The import engine (`src/utils/importEngine.ts`) accepts a JSON file in either the export format (`{ data: {...} }`) or a simplified flat format with these supported entities: `accounts`, `expenses` (→ JournalEntry expense), `incomes` (→ JournalEntry income), `loans`, `creditCards`.

**Import pipeline:**

1. **Account resolution:** Account names are used as identifiers. New accounts are created with generated IDs. Existing accounts are matched case-insensitively.
2. **Intra-file duplicate detection:** Two accounts in the same file with the same name — user picks which to keep (modal dialog).
3. **Existing duplicate detection:** New account matches an existing one — user chooses Merge or Skip.
4. **Loan/CreditCard import:** Resolved by name. EMI auto-calculated if missing. Default billing cycle values applied if missing.
5. **Expense/Income import:** Converted to `JournalEntry` records. Account resolved by name. Default account heads assigned (`head_expense` / `head_income`) if not specified.
6. **Transaction duplicate detection:** Same description + date + amount + account → saved as `ImportReview` with `status: "pending"`. Resolved in the Dup Review tab.

### Merge Accounts

The merge operation:
1. Finds all journal entries where `debitAccountHeadId === deleteId`, re-points to `keepId`
2. Finds all journal entries where `creditAccountHeadId === deleteId`, re-points to `keepId`
3. Re-points recurring payments, recurring incomes, loans, receivables from `deleteId` to `keepId`
4. Deletes the duplicate account (and its AccountHead mirror)
5. Clears sync queue to prevent stale deletes from uploading

### Clear Data

The `clearData()` action accepts:
- `local: boolean` — clears selected entity stores in IDB + clears syncQueue
- `cloud: boolean` — calls `adapter.clearCollections()` on Firestore (requires Firebase connected)
- `entities: EntityName[]` — which stores to clear

Account heads are re-seeded (5 root heads) if accountHeads was in the cleared entities list.

The UI presents named groups:
- Transactions (journalEntries)
- Accounts (accounts)
- Loans & Credit Cards (loans, creditCards, paymentOccurrences)
- Recurring (recurringPayments, recurringIncomes)
- Receivables (receivables, repaymentRecords)
- Investments (investments)
- Goals (goals)
- Import Reviews (importReviews)

---

## 15. State Lifecycle

### Boot sequence

```
1. AppProvider mounts
2. useEffect: openDB() → IDB v4 migration if needed
3. Repos.getAll() for all 14 entities → dispatch LOAD_ALL → loading: false
4. seedAccountHeads() → ensure 5 root heads exist
5. useEffect: balance worker spawned
6. triggerBalance() fires (300ms debounce) → computedBalances populated
7. Firebase config checked in localStorage → adapter registered if present
8. ?fbc= param checked → mobile auto-connect if present
```

### Save flow

```
user action (form submit)
  → save(entity, record)
    → BaseRepository.save() → IDB put
      → enqueueChange() → syncQueue IDB put → flush() async
    → dispatch UPSERT → React re-render
    → if entity in [accounts, creditCards, loans]:
        → save AccountHead mirror → dispatch UPSERT accountHeads
    → getPendingCount() → dispatch SET_SYNC_STATE { pendingCount }
    → if entity in [accounts, accountHeads, journalEntries]:
        → triggerBalance() (debounced 300ms)
          → worker.postMessage(input)
          → worker returns → dispatch SET_BALANCES
```

### Remove flow

```
user action (delete)
  → remove(entity, id)
    → BaseRepository.delete() → IDB delete
      → enqueueChange({ type: "delete" }) → flush() async
    → dispatch REMOVE
    → if entity in [accounts, creditCards, loans]:
        → Repos.accountHeads.delete(id)
        → dispatch REMOVE accountHeads
    → triggerBalance() fires → balances recomputed
```

### Reducer actions

| Action | Effect |
|---|---|
| `LOAD_ALL` | Bulk replace all state arrays, `loading: false` |
| `UPSERT` | Insert or update one record in one entity array |
| `REMOVE` | Filter one record out of one entity array |
| `RELOAD_ENTITY` | Replace entire entity array (used after Firebase realtime update) |
| `SET_BALANCES` | Replace `computedBalances` map |
| `SET_SYNC` | Update `syncStatus` and `sync.status` |
| `SET_SYNC_STATE` | Partial update to `sync` object |
| `SET_ERROR` | Set `error` message, `loading: false` |

---

## 16. Entity Interaction Map

```
Account ─────────────────────────────► AccountHead (mirror, same id)
   │                                        │
   │ openingBalance seeds                   │ parentId → head_asset or head_liability
   │                                        │
   ▼                                        ▼
balanceWorker ◄── JournalEntry ──────► debitAccountHeadId / creditAccountHeadId
   │               │    │                   │
   │               │    └── type=expense     └── Sub-heads: Food, Bills, Netflix…
   │               │    └── type=income
   │               │    └── type=transfer
   │               │    └── type=emi
   │               │    └── type=adjustment ◄── Reconciliation
   │               │
   │               └── transactionId ◄── PaymentOccurrence
   │                                          │
   ▼                                          └── sourceId
computedBalances                               ├── RecurringPayment (debitAccountHeadId default)
   │                                           ├── RecurringIncome
   ├── PaymentsView (balance after)            ├── Loan (amortisation)
   ├── AccountsView                            └── CreditCard
   ├── DashboardView
   └── JournalLedgerView (running balance)

Loan ──────────────────────────────────► AccountHead (mirror, same id, under head_liability)
CreditCard ──────────────────────────► AccountHead (mirror, same id, under head_liability)

Receivable ──────────────────────────► RepaymentRecord (receivableId FK)
Goal ────────────────────────────────► buildForecast (monthlyContribution)
Reconciliation ──────────────────────► JournalEntry (adjustmentTransactionId)
ImportReview ◄───────────────────────── importEngine (txDuplicates)
SyncQueue ────────────────────────────► FirebaseSyncAdapter → Firestore
```

---

## 17. Known Constraints & Design Decisions

### Fresh-start transaction history

When upgrading from DB v2/v3, all `expenses`, `incomes`, and `transfers` records are cleared. Users start with an empty journal. The rationale: these entities mapped directly to the old mutable-balance model and cannot be cleanly converted to double-entry journal entries without knowing the second account head for each transaction—information that was not stored.

### Opening balance represents pre-journal history

`Account.openingBalance` is the single source of truth for the account's historical value before any journal entry. It seeds the balance worker. It should be set to the actual account balance at the point when the user starts using FinTracker.

### computedBalances is not persistent

`computedBalances` is recalculated on every app boot and whenever journal entries change. It is never stored to IDB or synced to Firebase. This means balance computation is always deterministic and never out of sync with the transaction history.

### Account heads cannot be manually created for accounts

Account mirror heads (`isAccount: true`) are created and deleted exclusively through Account/CreditCard/Loan save and remove operations. They do not appear in the AccountHeads management UI. Users cannot create account-type heads manually—they must create an Account instead.

### PaymentsView debit head is locked

When marking a recurring payment as paid, the debit head (expense account head) shown in the pay dialog is read-only. It comes from `RecurringPayment.debitAccountHeadId` if set, or falls back to `head_expense`. The user can only choose the credit side (which bank account to pay from). If they want to change the debit head for a specific payment, they must edit the resulting journal entry afterward.

### Deterministic occurrence IDs prevent duplication

Payment occurrences use `occ_${sourceId}_${dueDate}` as their ID. This means the same month viewed multiple times always produces the same set of IDs, preventing duplicates in IDB even if the auto-save runs multiple times.

### Balance worker debounce prevents thrashing

A 300ms debounce on the balance trigger means bulk imports (100 entries saved in a loop) produce exactly one balance computation rather than 100. The worker always reads from `stateRef.current` (not stale closure state) so it always sees the final settled state.

### No authentication

FinTracker has no user accounts. Firebase Firestore security rules must be configured by the user to restrict access. The QR code pairing shares the full Firebase config including the API key—the user is warned about this in the UI.

### Forecast uses recurring data, not journal history

`buildForecast()` projects from the current `computedBalances` total forward using `recurringPayments`, `recurringIncomes`, loan amortisation schedules, and credit card due dates. It does not replay historical journal entries. This means the forecast is forward-looking from "now" rather than a time-series of recorded actuals.

### Sample import format

The sample import JSON (`/sample-import.json`) uses human-readable account names as identifiers (not UUIDs). The import engine resolves accounts by case-insensitive name match. IDs are generated on import if not provided.

---

*Report generated from source code as of FinTracker v4.0 — March 2026*
