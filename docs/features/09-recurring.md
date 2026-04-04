# Recurring Payments

## Description

Recurring Payments manages scheduled outflows such as rent, subscriptions, insurance or SIPs. Each recurring payment stores frequency, next due date, amount and status (active/paused), and the view shows monthly/annual summaries and time-until-due.

## Benefits

- Track obligations that repeat without recreating entries each time.
- Surface upcoming due dates and monthly totals for budgeting.
- Pause or edit recurring items without losing history.

## Workflow

1. Open `Recurring Payments` from the navigation.
2. Tap Add to define a new recurring payment (opens `RecurringPaymentForm`).
3. Configure name, category, frequency, amount, next date and account mapping.
4. Edit or delete recurrences using the row actions; pause/unpause via the record’s active flag.

## User expectations

- See a compact list of recurring obligations with next-date and amount.
- Know how soon a payment is due (days until next date) and the monthly total impact.
- Edit schedule, amount or category for any recurring payment.

## Dependencies

- Reads/writes: `recurringPayments`, `accounts`.
- Utilities: `daysFromNow` helper for due countdown and formatting utilities.

## Developer notes

- Implemented in: `src/components/views/RecurringView.tsx`.
- Form: `RecurringPaymentForm`; view uses `EntityView` and `useEntityFormPage`.
