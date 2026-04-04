# Data Export

## Description

Data Export lets users export selected application data as a versioned JSON backup file. The export contains one top-level object with `version`, `exportedAt`, and a `data` map of entity arrays.

## Benefits

- **Backup:** Create point-in-time backups of your data for safe-keeping.
- **Portability:** Move data between devices or accounts by importing the exported JSON.
- **Recovery:** Restore or inspect data before performing destructive operations (clear, delete, merges).
- **Auditing:** Downloaded JSON can be reviewed or processed externally.

## What it exports

The app lets you choose which entities to include. Implemented/exportable entities:

- `accounts`
- `accountHeads`
- `journalEntries`
- `recurringPayments`
- `recurringIncomes`
- `loans`
- `receivables`
- `repaymentRecords`
- `investments`
- `reconciliations`
- `goals`
- `paymentOccurrences`

The exported file shape is:

```
{
  "version": "4.0",
  "exportedAt": "2026-04-04T12:34:56.000Z",
  "data": { "accounts": [...], "journalEntries": [...], ... }
}
```

Files are downloaded with the pattern: `fintracker-export-<timestamp>.json` (timestamp uses `YYYY-MM-DD_HH-MM-SS`).

## Workflow

1. Open the app and go to Settings → Export.
2. Use the **All** / **None** shortcuts or click individual entity tiles to select exported entities.
3. Observe per-entity record counts shown on each tile to decide which entities to include.
4. Click the **Export** button. The browser will download a JSON file containing the selected entities.
5. Save the file to a safe location. Use Settings → Import to restore or review the data later.

## User expectations (what the user can do)

- Select or deselect any combination of entities before exporting.
- Export the current app state as a single JSON file.
- See how many records will be exported per entity before downloading.
- Quickly export all data using the **All** shortcut, or clear selection via **None**.
- Use the exported JSON to import back into the app or to store externally.

## Dependencies

- None required to perform an export from the client; the feature reads in-memory/app state and triggers a browser download.

## Notes for developers

- The export is implemented in `SettingsView` (ExportSection) and creates a JSON blob with `version` and `data` keys.
- Download filename and payload are generated in the client; large exports may be memory-intensive depending on record counts.
