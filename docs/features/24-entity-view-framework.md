# Entity View Framework

## Description

Entity View Framework is the shared UI and behavior layer for CRUD-style entity screens. It provides a common page shell, standard row actions, add/edit subpage flow, and dependency-aware delete confirmation.

## Benefits

- Reduces repeated CRUD wiring across feature views.
- Enforces consistent UX for add/edit/delete actions.
- Prevents unsafe deletes by checking linked dependencies first.

## Workflow

1. A feature view uses `EntityView` to render title, subtitle, and add action.
2. The feature wires `useEntityFormPage` with its entity name, record list, form component, and optional hooks.
3. Add/edit routes are handled through navigation subpages and `SubpageLayout`.
4. Deletions call dependency checks; if linked records exist, delete is blocked by confirmation details.
5. `RowActions` supplies reusable edit/delete controls per item row.

## User expectations

- Similar interaction patterns across Accounts, Loans, Receivables, etc.
- Clear prompts before destructive actions.
- Smooth subpage transitions for create and edit forms.

## Dependencies

- `src/context/AppContext.tsx`
- `src/context/NavigationContext.tsx`
- `src/context/ConfirmContext.tsx`
- `src/components/ui/subpage-layout.tsx`

## Developer notes

- Implemented in `src/components/views/EntityView.tsx`.
- Key exports: `EntityView`, `useEntityFormPage`, `RowActions`.
- `getDeleteDependencies` includes entity-specific checks (accounts, loans, investments, receivables, recurring entities) before allowing delete.
- Supports extension points via `formProps`, `onAfterSave`, and custom subpage names.
