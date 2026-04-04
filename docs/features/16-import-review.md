# Import Review

## Description

Import Review shows parsed import data for editing and final confirmation before saving to the database. It loads a pending import session (if any), lets users edit or remove journal entries, map imported accounts to existing accounts, review new loans/accounts, and then confirm a safe, ordered save.

## Benefits

- Resume and persist import review sessions without losing progress.
- Fine-grained control over remaps, merges and duplicate-resolution before writes.
- Clear summary of warnings and skipped items produced by the import engine.

## Workflow

1. The view loads a pending import session using `getPendingImport()` (from `importStore`).
2. The header shows counts for Transactions / Accounts / Loans and any plan warnings.
3. Review Journal Entries: edit entries (date, description, amount, type, notes), change debit/credit heads, remove entries, or open the edit dialog for detailed changes.
4. For new accounts, choose `link to` an existing account (accountRemap) or keep as a new account.
5. Review imported loans and account metadata; fix or remove items as needed.
6. Changes are persisted to the draft session via `savePendingImportDraft()` (auto-saved with a short debounce) so you can resume later.
7. Confirm Import: the view applies merges, saves accounts, loans, and journal entries, and writes import review records (via `makeTxReviewRecords`) before calling `markImportSessionCompleted()`.

## User expectations

- Preview and edit every incoming record before it touches the datastore.
- Easily remap imported accounts to existing accounts using a single select control.
- See warnings from the import engine and understand how many items will be skipped.

## Dependencies

- `src/utils/importStore.ts` — `getPendingImport`, `savePendingImportDraft`, `markImportSessionCompleted`
- `src/utils/importEngine.ts` — `makeTxReviewRecords`
- `src/utils/format.ts` for date/amount formatting (`fmt`, `fmtDate`)
- Types: `JournalEntry`, `Account`, `Loan` from `src/types`
- View implemented in: `src/components/views/ImportReviewView.tsx`

## Developer notes

- Draft state (edited entries and `accountRemap`) is saved periodically (250ms debounce) while `saveStep` is `idle`.
- `accountRemap` maps importAccountId → existingAccountId and is applied to debit/credit fields before saving.
- Confirm Import order: apply merges (update existing entities) → save new accounts → save new loans → save journal entries (with remaps applied) → save import review records → mark session completed.
- `planErrors` contains import-engine warnings; these are surfaced and counted in the final `importResult.skipped`.
- `headOptions` combines import-new accounts, existing accounts and account heads to populate the edit selects.
- The edit dialog exposes `TYPE_OPTIONS` and the full set of editable fields for a `JournalEntry`.


*Implemented in*: `src/components/views/ImportReviewView.tsx`
