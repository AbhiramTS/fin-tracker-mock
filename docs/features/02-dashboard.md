# Dashboard

## Description

The Dashboard is the app's overview page: a single-pane snapshot of your financial KPIs and short-term forecast. It aggregates total balances, safe-to-spend, net worth, upcoming payments, goals progress and visual charts (60-day balance forecast, spending breakdown, monthly spending bars, and net-worth trend).

## Benefits

- Fast, actionable overview of your finances.
- Early warning for projected shortfalls so you can act before balances run out.
- Visual breakdowns (spending by category, monthly trends) to surface priorities.
- Central place to jump from high-level metrics to detailed views.

## Workflow

1. Open the Dashboard from the main navigation.
2. Scan the alert bar (if shown) for shortfall warnings.
3. Review the KPI grid (Total Balance, Safe to Spend, Net Worth, Monthly Out).
4. Inspect the 60-day forecast to understand upcoming balance changes.
5. Check Debt Stress and Next Income widgets for cashflow context.
6. Use Spending Breakdown and Monthly Spending charts to spot large categories and month-to-month trends.
7. Open detailed views (Accounts, Journal, Goals, Forecast) from the navigation to act on items you find.

## User expectations

- See an at-a-glance health score and whether a shortfall is projected.
- Understand where money is going (top spending categories) and month-to-month patterns.
- Identify upcoming unpaid obligations and active goals progress.
- Use this page as an entry point to deeper workflows (e.g., open the journal to edit transactions, open accounts to reconcile).

## Dependencies

- Data required: `accounts`, `accountHeads`, `journalEntries`, `recurringIncomes`, `investments`, `loans`, `receivables`, `goals`.
- Chart components and helpers: `ForecastChart`, `SpendingDonut`, `MonthlyBarsChart`, `NetWorthChart`, and `buildForecast` utility.

## Developer notes

- Implemented in: `src/components/views/DashboardView.tsx`.
- Core forecast logic lives in `src/utils/forecast.ts` (see `buildForecast`).
