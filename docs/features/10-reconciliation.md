# Reconciliation History

## Description

Reconciliation History displays past account reconciliations: tracked balance vs actual balance, the difference, and optional notes. Reconciliations are created when a user reconciles an account (via the Accounts view), and an adjustment journal entry may be recorded to correct differences.

## Benefits

- Maintain an audit trail of reconciliations and adjustments for accountability.
- Quickly verify whether past reconciliations balanced or required adjustments.
- Provide context for balance changes and adjustment transactions.

## Workflow

1. Open `Reconciliation History` from the navigation or Settings → Reconciliations.
2. Browse reconciliation records sorted by reconciled date (newest first).
3. For each record, view tracked balance, actual balance, difference and any notes.
4. To perform a new reconciliation, go to `Accounts` and use the Reconcile action on an account (this view is read-only history).

## User expectations

- See a list of reconciliation entries with status (Balanced vs Diff) and the numeric difference.
- Inspect tracked vs actual balances and any notes the user left during reconciliation.
- Understand which account a reconciliation relates to and when it occurred.

## Dependencies

- Reads: `reconciliations`, `accounts`.
- Reconciliation creation: `AccountsView` triggers `ReconciliationForm` which may write an adjustment to `journalEntries` and a `reconciliations` record.

## Developer notes

- Implemented in: `src/components/views/ReconciliationView.tsx`.
- Reconciliation form & adjustment creation live in `src/components/views/AccountsView.tsx` (the ReconciliationForm is rendered from there).
