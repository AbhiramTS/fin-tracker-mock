# Transfers

## Description

Transfers records money moved between your own accounts (for example, moving cash from bank A to bank B). Each transfer is a paired journal entry that debits one account and credits another.

## Benefits

- Avoids double-counting transfers as income or expense while keeping a clear audit trail.
- Makes it easy to reconcile movements between accounts.

## Workflow

1. Open the `Transfers` view from the navigation.
2. Tap Add to create a new transfer (opens `TransferForm`).
3. Provide source and destination account heads, amount and date.
4. Edit or delete transfers using the row actions.

## User expectations

- Record internal movements between accounts with a simple form.
- See transfers listed with from → to heads, amounts and dates.
- Edit or remove transfers as needed.

## Dependencies

- Reads/writes: `journalEntries` (type: `transfer`), `accountHeads` and `accounts`.

## Developer notes

- Implemented in: `src/components/views/TransfersView.tsx`.
- Form component: `TransferForm`; list uses `EntityView` and `useEntityFormPage`.
