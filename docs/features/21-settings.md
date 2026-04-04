# Settings

## Description

Settings is the operations and system-management hub for FinTracker. It centralizes export, duplicate review, account merge tools, data clearing, Firebase sync controls, notification setup, AI agent configuration, install guidance, and data summary diagnostics.

## Benefits

- One place for maintenance and operational controls.
- Safe data export/cleanup and duplicate handling workflows.
- Built-in sync visibility (status, pending count, last sync, errors).

## Workflow

1. Open Settings.
2. Use tabbed operations area:
3. Export: run data export actions.
4. Merge: merge duplicate accounts and repoint related entities.
5. Dups: review import duplicate transactions and resolve decisions.
6. Clear: clear selected/all local data.
7. Configure Firebase sync (connect/disconnect, sync now, QR transfer).
8. Configure notifications (in-app/browser/push), test channels.
9. Open AI Agent config panel and test/save connectivity.
10. Review install-as-app instructions and data summary metrics.

## User expectations

- Core maintenance actions are grouped and easy to find.
- Sync health is visible and actionable.
- Risky actions (merge/clear/disconnect) provide clear feedback.

## Dependencies

- `src/components/views/SettingsView.tsx` sections:
- `ExportSection`, `MergeAccountsSection`, `TxDuplicateReview`, `ClearDataSection`, `AIAgentSettings`
- `src/utils/notifications.ts` for browser/push notification controls
- `src/context/AppContext.tsx` for sync and storage operations
- `src/agent/llm.ts` for agent connection test

## Developer notes

- Implemented in `src/components/views/SettingsView.tsx`.
- Firebase config persistence uses local storage key `ft_firebase_config`.
- Merge operation updates linked references across journal entries, recurring entities, loans, and receivables before deleting the duplicate account.
- Duplicate review decisions write back to `importReviews` with resolved status and optional overwrite/create actions.
- Account Heads has its own dedicated view and is linked from this page.
