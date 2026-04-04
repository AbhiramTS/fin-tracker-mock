# Credit Cards

## Description

Tracks credit card accounts, billing cycles, outstanding/billed amounts, utilisation and due dates. Shows linked EMI items from credit-card loans that fall within the current billing cycle.

## Benefits

- Monitor outstanding balances and utilisation to avoid over-limit or high-interest scenarios.
- See cycle-level details (statement day, due date, grace period) and linked EMI obligations.
- Jump to a card ledger to review transactions and payments.

## Workflow

1. Open `Credit Cards` from the navigation.
2. Add or edit credit card accounts (limit, statement day, billing cycle, grace days, tax settings).
3. For each card, view the current cycle billed amount, outstanding, linked EMIs and utilisation percentage.
4. Tap a card to open its ledger (transactions) or use row actions to edit/delete the card.

## User expectations

- See total outstanding across cards and per-card billed totals.
- Understand next due date and days remaining, plus how much of the limit is used.
- See EMIs linked to the card for the current billing window.

## Dependencies

- Reads/writes: `accounts` (type: `credit_card`), `loans` (credit-card loans), `journalEntries`.
- Utilities: credit-card cycle and amortisation helpers (`currentCreditCardCycle`, `generateAmortisation`).

## Developer notes

- Implemented in: `src/components/views/CreditCardsView.tsx`.
- Linked EMIs are found by searching `loans` with `loanType === 'credit_card'` and `linkedCreditCardId` matching the card.
