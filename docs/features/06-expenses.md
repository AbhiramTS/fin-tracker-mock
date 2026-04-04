# Expenses

## Description

Expenses is the transactional view for recording and reviewing spending journal entries. It shows a monthly spending chart, top categories, category filters and a chronological list of expense transactions. Users can add, edit and delete expense entries.

## Benefits

- Track where money is spent and identify high-cost categories.
- Visual monthly trends and top-category bars help prioritise cuts or budget adjustments.
- Quick add/edit flow for logging receipts and expenses.

## Workflow

1. Open the `Expenses` view from the main navigation.
2. Use the category chips to filter expenses by category (derived from debit account head).
3. Inspect the Monthly Spending chart and the By Category card for top spenders.
4. Tap the Add button to record a new expense (opens `ExpenseForm`).
5. Use row actions to edit or delete existing expense entries.

## User expectations

- Create expense entries with description, date, amount, debit and credit heads, notes and tags.
- Filter and browse expenses by category and date.
- See totals for the current filter and for all expenses.

## Dependencies

- Reads/writes: `journalEntries` (type: `expense`), `accountHeads`, `accounts`.
- Charts: `MonthlyBarsChart` expects expense-shaped data.

## Developer notes

- Implemented in: `src/components/views/ExpensesView.tsx`.
- Uses: `ExpenseForm`, `EntityView`, `useEntityFormPage` and `RowActions` helper.
