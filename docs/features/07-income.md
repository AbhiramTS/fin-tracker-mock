# Income

## Description

Income covers both recurring income streams (salary, rent, subscriptions) and one-off income entries. The view shows recurring income by frequency, next payment date, and lists one-off receipts. Recurring incomes contribute a monthly estimate used by the forecast.

## Benefits

- Track regular and one-off income separately for clearer cashflow forecasting.
- See next scheduled payments and estimated monthly recurring income.
- Easy add/edit/remove for both recurring and one-off income.

## Workflow

1. Open the `Income` view from the navigation.
2. Use the tabs to switch between Recurring and One-off income.
3. Add recurring income (frequency, amount, next date) or a one-off income entry using the Add button.
4. Edit or delete existing income lines using row actions.

## User expectations

- Add recurring income with frequency and next-date so the app can include it in forecasts.
- Add one-off income entries (e.g., sale proceeds, refunds).
- See per-entry details: frequency, next-date, active/paused state, and amounts.

## Dependencies

- Reads/writes: `journalEntries` (type: `income`), `recurringIncomes`, `accounts`, `accountHeads`.
- Utility: monthly equivalent calculation uses a frequency multiplier map in the view.

## Developer notes

- Implemented in: `src/components/views/IncomeView.tsx`.
- Forms: `IncomeForm` (one-off) and `RecurringIncomeForm` (recurring); handled via `useEntityFormPage`.
