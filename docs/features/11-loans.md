# Loans & EMIs

## Description

Manages loans and EMI schedules (home, personal, auto loans and credit-card-linked loan records). Each loan shows outstanding principal, EMI amount, paid months, progress, amortisation schedule and estimated totals (interest, tax, cost).

## Benefits

- Track outstanding debt and EMI progress at a glance.
- View amortisation schedules and expected tax/interest components.
- Auto-post loan disbursal entries and integrate EMIs with the payments pipeline.

## Workflow

1. Open `Loans & EMIs` from the navigation.
2. Add a new loan with principal, rate, tenure, start date and (optional) tax settings.
3. View each loan card to see outstanding, EMI, months left and a progress bar.
4. Expand a loan to view the amortisation schedule; use the ledger link to see transaction history.
5. Edit or delete loans using row actions. Creating a new loan auto-posts a loan disbursal journal entry.

## User expectations

- See outstanding balance, EMI and months remaining per loan.
- Inspect amortisation rows, with tax columns when applicable.
- EMIs can be linked to payment occurrences and increment paid months when paid.

## Dependencies

- Reads/writes: `loans`, `journalEntries`, `paymentOccurrences`, `accounts`.
- Utilities: amortisation helpers (`generateAmortisation`, `outstandingPrincipal`, `totalInterest`, `calculateEMI`).

## Developer notes

- Implemented in: `src/components/views/LoansView.tsx`.
- Loan creation handler may auto-create a `loan_disbursal` journal entry on save.
