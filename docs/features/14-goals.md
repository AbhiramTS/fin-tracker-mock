# Financial Goals

## Description

Goals lets users define financial targets (emergency fund, down payment, vacation) with target amounts, monthly contributions, target dates and progress tracking. Cards show percent funded, remaining amount and estimated completion date if monthly contributions are provided.

## Benefits

- Encourage disciplined saving with visible progress and estimated completion.
- Track multiple goals separately and prioritise contributions.
- Mark goals completed and keep a history of paused/completed goals.

## Workflow

1. Open `Financial Goals` from the navigation.
2. Add a new goal with target amount, optional monthly contribution and target date.
3. View goal cards showing progress bars, saved vs target, and estimated completion date.
4. Edit, pause or mark goals as completed via row actions or the CTA on a full-funded goal.

## User expectations

- See active, paused and completed goals grouped and summarised.
- Get an estimated completion date derived from monthly contributions.
- Update saved/current amount manually or via linked transactions (depending on workflow).

## Dependencies

- Reads/writes: `goals` (may be linked to `journalEntries` for funding records).

## Developer notes

- Implemented in: `src/components/views/GoalsView.tsx`.
- Uses helper `estimateCompletion` to compute an estimated done date; adjust logic there if contribution semantics change.
