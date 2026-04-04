# Receivables

## Description

Receivables (Money Lent) tracks amounts you lend to people and monitors repayment progress over time. It combines receivable records with repayment entries and linked journal transactions so outstanding balances, settlement status, and repayment history stay accurate.

## Benefits

- Central place to track money lent and what is still outstanding.
- Repayment recording creates accounting entries automatically.
- Ledger drill-down is available for receivables linked to account heads.

## Workflow

1. Open Money Lent from navigation.
2. Add a receivable using the receivable form (person, amount lent, date, expected repayment, linked account/head).
3. On new receivable save, the app auto-posts a `lending_disbursal` journal entry when required fields are present.
4. Review active cards with outstanding balance, progress bar, expected date, and repayment history.
5. Record repayment from the card; this stores a repayment record and posts a `lending_repayment` journal entry.
6. Open the ledger subpage for deeper analysis when receivable-head linkage exists.

## User expectations

- See active vs settled receivables clearly.
- Track overdue/expected repayment timing.
- Record repayments quickly from the receivable card.

## Dependencies

- `src/utils/receivables.ts` (`getReceivableJournalStats`)
- `src/components/forms` (`ReceivableForm`, `RepaymentForm`)
- `src/components/views/AccountLedger.tsx` (`ReceivableLedgerPage`)
- Entities: `receivables`, `repaymentRecords`, `journalEntries`, `accounts`, `accountHeads`

## Developer notes

- Implemented in `src/components/views/ReceivablesView.tsx`.
- New receivables can trigger automatic `lending_disbursal` journal posting in `onAfterSave`.
- Repayment flow writes both `repaymentRecords` and a matching `lending_repayment` journal entry.
- Outstanding/settled status is derived from journal-backed stats, not just static fields.
