# Investments

## Description

Investment tracking and portfolio overview for holdings like stocks, mutual funds, FDs, PPF, crypto and others. Shows portfolio value, cost basis, P&L and per-asset-type breakdown with a donut chart and per-investment ledger access.

## Benefits

- Centralised portfolio view with value, cost and profit/loss metrics.
- Visual breakdown of allocation by investment type to inform rebalancing decisions.
- Quick access to individual investment ledgers and inline editing of entries.

## Workflow

1. Open `Investments` from the navigation.
2. See portfolio totals (value, cost, P&L) and a donut allocation chart when multiple investments exist.
3. Add a new investment (type, cost basis, current value, name) or edit existing ones.
4. Tap an investment to open its ledger for transaction-level details.

## User expectations

- View total portfolio value and per-investment value and P&L.
- Identify allocation percentages by type (stocks, mutual funds, etc.).
- Edit investments and track cost basis vs current value.

## Dependencies

- Reads/writes: `investments`, `journalEntries` (if ledger entries are used), `accounts` (optional linking).
- Charts: `PortfolioDonut` for allocation visualization.

## Developer notes

- Implemented in: `src/components/views/InvestmentsView.tsx`.
- Types are mapped to UI colors; ensure new investment types are added to `TYPE_COLORS` if necessary.
