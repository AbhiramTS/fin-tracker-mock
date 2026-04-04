# Ledger Alias

## Description

Ledger Alias keeps backward compatibility for the old Account Book tab/component naming by re-exporting Journal Ledger as Ledger View.

## Benefits

- Prevents breakage where legacy imports still reference `LedgerView`.
- Maintains migration path while the product standardizes on Journal Ledger terminology.

## Workflow

1. Legacy code imports `LedgerView`.
2. Alias file re-exports `JournalLedgerView` under that name.
3. Runtime behavior remains identical to Journal Ledger.

## User expectations

- No separate behavior or UI differences from Journal Ledger.
- Older routes/imports continue working during transition.

## Dependencies

- `src/components/views/JournalLedgerView.tsx`

## Developer notes

- Implemented in `src/components/views/LedgerView.tsx`.
- This file is intentionally minimal and acts as a compatibility bridge.
