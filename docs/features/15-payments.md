# Payments

## Description

Payments is the schedule and execution UI for due items: recurring payments, loan EMIs, credit-card bills and expected recurring income. It aggregates monthly occurrences, shows overdue/upcoming/paid/skipped sections and provides a Pay dialog to create payment journal entries.

## Benefits

- Centralised due-date tracking for bills, EMIs and recurring items.
- Simple confirmation flow to mark items paid (with optional top-up to cover shortfall), which creates the appropriate journal entry and updates payment occurrences.
- Automatically advances the next due date for recurring sources and increments loan paid months when EMIs are recorded.

## Workflow

1. Open `Payments` and navigate months using the month navigator.
2. Review the Month Summary (Total Out, Paid, Unpaid, Overdue/Income) and sections for Overdue, Upcoming, Paid, Skipped and Expected Income.
3. For an unpaid occurrence, open the Pay dialog to select the account to pay from, enter amount and optional top-up to cover shortfall.
4. Confirm payment: the app creates a `journalEntry` (expense/emi/credit_card_payment/income), marks the occurrence as `paid`, and advances the recurring source's `nextDate` when applicable.
5. Skip or undo a payment occurrence using Skip / Undo actions.

## User expectations

- See all due items for the chosen month categorised by status.
- Mark items as paid from a selected account and optionally top up the account balance before payment.
- Paid EMIs increment loan progress; paying recurring items advances their next date.

## Dependencies

- Reads/writes: `paymentOccurrences`, `journalEntries`, `recurringPayments`, `recurringIncomes`, `loans`, `accounts`, `accountHeads`.
- Utilities: recurring helpers (`getOccurrencesForMonth`, `advanceByFrequency`, `resolveMonthScheduleRule`) and urgency helpers for UI signalling.

## Developer notes

- Implemented in: `src/components/views/PaymentsView.tsx`.
- Key behaviour: `confirmPaid` creates the main journal entry, optionally posts a top-up `income` entry, marks the occurrence `paid`, advances `nextDate` for recurring sources, and increments `paidMonths` for loan EMIs.
