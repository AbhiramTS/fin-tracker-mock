# Account Heads

## Description

Account Heads is the chart-of-accounts management interface. It exposes root heads (asset, liability, income, expense, equity) and lets you add and manage child heads used to categorise journal entries and to link records (accounts, loans, investments, receivables).

## Benefits

- Maintains a consistent, hierarchical chart of accounts for accurate categorisation.
- Lets users create specialized heads (bank, loan, credit card) that may be linked to actual account/loan/investment records.
- Prevents accidental deletion of heads that are in use.

## Workflow

1. Open `Account Heads` from Settings → Account Heads (or the Account Heads view).
2. Browse fixed root heads and expand child heads.
3. Add a child head under any root with a name and optional entity hint (e.g., create as a bank, loan, credit card).
4. Edit a non-system head to rename or change its parent/type.
5. If a head is linked to an account/loan/investment/receivable, use the “Edit linked record” action to jump to that record.
6. Delete a head only when it has no children and is not referenced by transactions or receivables.

## User expectations

- Create new categories and sub-categories to organise transactions.
- See which heads are system vs user-created and which heads are linked to records.
- Prevent removal of heads that are in active use.

## Dependencies

- Reads and updates: `accountHeads`, `accounts`, `loans`, `investments`, `receivables`, `journalEntries`.

## Developer notes

- Implemented in: `src/components/views/SettingsView.tsx` (exported `AccountHeadsView`).
- Behaviour: children cannot be deleted if they have usage; linking logic opens the appropriate edit subpage.
