# FinTracker v4

A local-first, mobile-friendly personal finance app. Fully offline-capable, with optional Firebase real-time sync and installable as a PWA.

## What's covered (BRD/PRD/FRD reconciled)

| Feature                                           | Status                  |
| ------------------------------------------------- | ----------------------- |
| Manual expense, income, transfer entry            | ✅                      |
| Recurring income & payments (separate)            | ✅                      |
| Account management (6 types)                      | ✅                      |
| Loan tracking with full amortisation schedule     | ✅                      |
| Credit card EMIs (separate from normal loans)     | ✅                      |
| Money lent / Receivables with repayment tracking  | ✅                      |
| Investment portfolio with P&L                     | ✅                      |
| Financial Goals (6 types, completion estimate)    | ✅                      |
| Account Reconciliation (tracked vs actual)        | ✅                      |
| 90-day balance forecast with shortfall detection  | ✅                      |
| Financial Simulator (loan / purchase / recurring) | ✅                      |
| Safe-to-spend calculation                         | ✅                      |
| Charts: forecast, donut, monthly bars, net worth  | ✅                      |
| Double-entry accounting foundation                | ✅ (types + IDB schema) |
| Firebase real-time sync (Firestore)               | ✅                      |
| QR code desktop→mobile sync                       | ✅                      |
| PWA (installable, offline, service worker)        | ✅                      |
| shadcn UI with Radix primitives                   | ✅                      |

## Tech stack

- **React 18** + **TypeScript**
- **shadcn/ui** (Radix UI + Tailwind CSS)
- **Recharts** for charts
- **Firebase JS SDK v10** (modular, lazy-loaded)
- **IndexedDB** as primary store (offline-first)
- **qrcode** for QR generation
- **Vite** + **GitHub Actions** for CI/CD

## Quick start

```bash
npm install
npm run dev
```

## Deploy to GitHub Pages

1. **Settings → Pages → Source → GitHub Actions**
2. Push to `main` — the workflow builds and deploys automatically

If your URL is `username.github.io/fintracker/` (no custom domain), change `base: "/"` to `base: "/fintracker/"` in `vite.config.ts`.

## Firebase setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add a **Web app** → copy the config
3. Enable **Firestore Database** (start in test mode)
4. Open FinTracker → **Settings → Firebase Sync** → paste your config

### Recommended Firestore rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{collection}/{document} {
      allow read, write: if request.auth != null; // add auth for production
    }
  }
}
```

### QR sync

After connecting Firebase on desktop → **Settings → QR Sync Code** → scan with phone. The QR encodes your config as a base64 URL parameter. Opens the app on your phone with Firebase already connected.

## File structure

```
src/
├── types.ts                     All TypeScript interfaces (13 entities)
├── db/indexedDB.ts              IDB primitives (13 stores)
├── repositories/                BaseRepository + all 13 entity singletons
├── sync/                        SyncAdapter, FirebaseSyncAdapter, syncQueue
├── context/AppContext.tsx       React context + useReducer
├── utils/
│   ├── amortisation.ts          EMI calc, full schedule, outstanding principal
│   ├── forecast.ts              90-day cash-flow projection
│   ├── format.ts                fmt, fmtDate, fmtCompact, addDays…
│   ├── id.ts                    generateId()
│   └── pwa.ts                   Service worker registration
├── qr/qrcode.ts                 renderQR() wrapper around qrcode library
├── lib/utils.ts                 cn() helper
├── components/
│   ├── ui/                      shadcn: Button, Card, Badge, Dialog, Input…
│   ├── charts/                  ForecastChart, SpendingDonut, MonthlyBars…
│   ├── forms/                   One typed form per entity (13 forms)
│   └── views/                   15 page views
└── App.tsx                      Shell: desktop sidebar + mobile bottom nav
```

## Architecture

```
IndexedDB (primary, offline-first)
  └── BaseRepository (typed CRUD + change log)
        └── SyncQueue (queues changes, retries on reconnect)
              └── FirebaseSyncAdapter (pushChanges + onSnapshot real-time)
                    └── Firestore (cloud layer only)

AppContext (useReducer) → Views → Forms → Dialogs
```
