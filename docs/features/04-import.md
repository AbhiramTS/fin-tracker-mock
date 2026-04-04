# Import Data

## Description

Import Data provides a guided flow for ingesting FinTracker JSON exports (or compatible files). It parses uploaded or pasted JSON, detects intra-file and existing-data duplicates, lets you resolve conflicts, and stages a review session before final save.

## Benefits

- Safely bring external or backup data into the app with duplicate detection.
- Review and edit imported data before it mutates your existing dataset.
- Resume pending import sessions if you need more time to review.

## Workflow

1. Open `Import Data` from the navigation.
2. Choose import mode: Upload a JSON file or Paste JSON.
3. If the parser finds names duplicated inside the file, resolve intra-file duplicates by selecting which version to keep.
4. If incoming records match existing records, choose whether to merge or skip each match.
5. Once resolutions are applied the session is stored and you are taken to the import-review flow to inspect and save the changes.
6. You can resume or discard pending import sessions from the same view.

## User expectations

- Import accounts, loans, journal entries and associated data from a JSON file.
- Be prompted and guided when conflicts are detected, with safe defaults.
- Download a sample import file (`/sample-import.json`) to understand expected format.
- Review everything before committing imported records to the local store.

## Dependencies

- Parsing and staging utilities: `src/utils/importEngine.ts` and `src/utils/importStore.ts`.
- Import review flow is handled by the Import Review view (`ImportReviewView`).

## Developer notes

- Implemented in: `src/components/views/ImportView.tsx`.
- Key behaviours: `parseImportFile` creates a plan, which is stored and later applied by the review flow. Duplicate-resolution dialogs handle intra-file and existing-data conflicts.
