# Account Ledger Subpages

## Description

Account Ledger Subpages provide focused ledger drill-down pages for individual entities such as bank/cash accounts, loans, credit cards, receivables, investments, and generic account heads. Each subpage renders the shared journal ledger filtered to the selected account head.

## Benefits

- Single-source ledger experience reused across multiple entity views.
- Entity-specific context (balance, outstanding, cost basis, repayment stats) shown above entries.
- Consistent back navigation and page framing via subpage layout.

## Workflow

1. Open an entity view that supports ledger drill-down (Accounts, Loans, Credit Cards, Receivables, Investments, Account Heads).
2. Enter the ledger subpage for a specific record.
3. Review summary metadata shown in the subpage header.
4. Inspect transactions in `JournalLedgerView` filtered by `filterAccountHeadId`.

## User expectations

- See only transactions relevant to the selected entity.
- Keep context while navigating back to the parent entity screen.
- Get domain-specific summary data in each ledger variant.

## Dependencies

- `src/components/views/JournalLedgerView.tsx`
- `src/components/ui/subpage-layout.tsx`
- `src/utils/receivables.ts` for receivable stats
- `src/utils/format.ts` for summary formatting

## Developer notes

- Implemented in `src/components/views/AccountLedger.tsx`.
- Exported pages: `AccountLedgerPage`, `LoanLedgerPage`, `CreditCardLedgerPage`, `ReceivableLedgerPage`, `InvestmentLedgerPage`, `AccountHeadLedgerPage`.
- All variants rely on `JournalLedgerView` with `filterAccountHeadId` to scope data.
