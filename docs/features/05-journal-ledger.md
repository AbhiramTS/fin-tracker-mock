# Journal Ledger

## Description

The Journal Ledger (Account Book) is where users create, edit, review and reorder double-entry transactions (journal entries). It supports multiple entry types (expense, income, transfer, EMI, adjustment, opening balance, etc.), filters, searching, and running balances.

## Benefits

- Full visibility and control over all ledger transactions.
- Powerful filtering and search to find specific entries quickly.
- Supports EMIs and auto-generates payment occurrences when EMI entries are recorded.
- Running balances provide immediate account/head-level context.

## Workflow

1. Open the Account Book (Journal Ledger) from navigation.
2. Use the search box and Filters panel to narrow entries by type, account head, date range, or amount.
3. Add a new journal entry via the Add button (opens the `JournalEntryForm`).
4. Expand an entry to see details; edit or delete using the actions shown.
5. Drag to reorder rows when no search/filters are active (this updates `sortOrder` and can move an entry's date).
6. Recording an `emi` entry triggers amortisation logic that may create or update a `paymentOccurrence` for the loan.

## User expectations

- Create transactions with debit and credit heads, amounts, dates, tags and notes.
- Filter, search, and reorder transactions to match bookkeeping needs.
- Edit historical entries and see running balances update accordingly.
- EMI-specific behaviour: EMI entries can auto-link to loan schedules and mark payment occurrences as paid.

## Dependencies

- Uses: `journalEntries`, `accounts`, `accountHeads`, `loans`, and `paymentOccurrences`.
- Utilities: amortisation generator and recurring helpers (`generateAmortisation`, `occurrenceId`).

## Developer notes

- Implemented in: `src/components/views/JournalLedgerView.tsx`.
- Form component: `JournalEntryForm` (used via `useEntityFormPage`).
- Reordering and running-balance logic are implemented in the view; ensure `sortOrder` semantics when modifying row order.
