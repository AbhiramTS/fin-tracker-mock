# Accounts

## Description

The Accounts feature manages bank, cash, and similar account records and exposes an account-level ledger. It shows computed balances, supports adding/editing accounts, opening an account ledger, and reconciling an account's tracked balance with the actual balance.

## Benefits

- Central place to view and manage everyday accounts (bank, cash).
- Reconciliation ensures on-device balances match bank statements and creates adjustment transactions when needed.
- Quick access to an account's detailed ledger for transaction-level inspection.

## Workflow

1. Open the `Accounts` view from the navigation.
2. See a list of bank/cash accounts with computed balances and a combined total.
3. Add a new account via the Add button (opens account form).
4. Click an account to open its ledger page (transactions for that account).
5. Use the Reconcile action to enter an actual balance; the app will create an adjustment journal entry (if required) and save a reconciliation record.
6. Edit or delete accounts using the row actions (delete is subject to safeguards).

## User expectations

- Add, rename and remove accounts (removal only when safe).
- View current computed balance per account and a combined total for listed accounts.
- Open an account's ledger and examine transactions for that account.
- Reconcile an account: supply the actual/tracked balance and optionally create an adjustment entry automatically.

## Dependencies

- Uses `accountHeads` for categorisation in account forms.
- Reconciliation writes `journalEntries` (adjustment) and `reconciliations` records.

## Developer notes

- Implemented in: `src/components/views/AccountsView.tsx`.
- Key components: `AccountForm`, `ReconciliationForm`, and `AccountLedgerPage`.
