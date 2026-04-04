# Financial Simulator

## Description

Financial Simulator models the impact of planned decisions before committing them. It offers three calculators: Loan impact, one-time Purchase impact, and new Recurring commitment impact.

## Benefits

- Quick risk signal (`Manageable` vs `Risky`) for common decisions.
- Uses current in-app balances and obligations for context-aware outputs.
- Helps estimate runway and affordability without editing real records.

## Workflow

1. Open Financial Simulator.
2. Review context cards: current liquid balance and monthly outflow.
3. Choose a tab:
4. Loan: enter principal, rate, tenure; simulator computes EMI, updated obligations, buffer months, total interest.
5. Purchase: enter one-time spend; simulator computes post-purchase balance and months of obligations covered.
6. Recurring: enter additional monthly amount; simulator computes new monthly total, annual cost, and burden ratio.

## User expectations

- Instant result card after simulation with clear status and highlighted risky metrics.
- No permanent data mutation; this is analysis-only.

## Dependencies

- `src/utils/amortisation.ts` (`calculateEMI`)
- `src/utils/format.ts` (`fmt`)
- State inputs: account balances, recurring payments, loan EMIs

## Developer notes

- Implemented in `src/components/views/SimulatorView.tsx`.
- `totalBalance` uses cash/bank accounts and computed balances fallbacking to opening balance.
- `monthlyOut` includes active recurring payments and existing loan EMIs.
- Risk heuristics are threshold-based and intentionally lightweight.
