# Forecast

## Description

Forecast provides a forward-looking 90-day balance timeline based on current state, recurring events, and scheduled obligations. It highlights projected shortfalls and displays daily event impacts.

## Benefits

- Early warning when future balance may go negative.
- Visual plus list-based timeline makes upcoming risk easy to inspect.
- Useful for planning transfers, spending cuts, or income timing.

## Workflow

1. Open 90-Day Forecast.
2. The view builds timeline data through `buildForecast(state, 90)`.
3. Check the status badge:
4. `Stable` when no shortfall is detected.
5. `Shortfall <date>` when projection crosses below zero.
6. Inspect chart trend and per-day cards with event breakdown and resulting balance.

## User expectations

- Forecast updates automatically from current app data.
- Each day card shows contributing events and impact amounts.
- Empty-state guidance appears when there is insufficient recurring/scheduled data.

## Dependencies

- `src/utils/forecast.ts` (`buildForecast`)
- `src/components/charts` (`ForecastChart`)
- `src/utils/format.ts` (`fmt`, `fmtDate`, `fmtDateFull`)

## Developer notes

- Implemented in `src/components/views/ForecastView.tsx`.
- Shortfall state is derived from `buildForecast` output (`shortfall`).
- UI uses both chart and detailed day-event cards for explainability.
