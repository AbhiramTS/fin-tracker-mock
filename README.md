# FinTracker

Personal finance forecasting — offline-first, Firebase-synced, installable as a PWA.

## Features

- **Dashboard** — balance, net worth, safe-to-spend, stress score, 60-day forecast chart
- **Expenses** — log & categorise with monthly bar chart and donut breakdown
- **Accounts, Income, Recurring, Loans, Credit Cards, Investments** — full CRUD for every entity
- **Forecast** — 90-day cash-flow timeline with shortfall detection
- **Simulator** — model a new loan or big purchase before committing
- **Firebase sync** — real-time Firestore sync across all your devices
- **QR Code** — scan from desktop to connect mobile in one tap (no login needed)
- **PWA** — install as a native-like app on iOS, Android, or desktop

## Architecture

```
IndexedDB (primary store)
  └─ BaseRepository  (CRUD + change enqueue)
       └─ SyncQueue  (offline-first change log)
            └─ FirebaseSyncAdapter  (push/pull + onSnapshot real-time)
                   └─ Firestore (cloud layer only)

AppContext (React)  →  Views  →  Forms
```

Data always lives in IndexedDB first. Firebase is the sync layer — the app works fully offline.

## Quick start (local dev)

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Deploy to GitHub Pages

### 1. Enable GitHub Pages in your repo

Go to **Settings → Pages → Source** and select **GitHub Actions**.

### 2. Custom domain (optional but recommended)

If you're deploying to `https://yourdomain.com`, leave `vite.config.ts` as-is (`base: "/"`).

If you're deploying to `https://username.github.io/fintracker/` (no custom domain), update `vite.config.ts`:

```ts
base: "/fintracker/",   // ← your repo name
```

And update `public/sw.js` — replace `"/"` with `"/fintracker/"` in the precache list.

### 3. Push to `main`

```bash
git add .
git commit -m "initial commit"
git push origin main
```

The **Deploy to GitHub Pages** workflow runs automatically.  
Check **Actions** tab for build status. Your app will be live at the URL shown in Pages settings.

## Firebase setup

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Add a **Web app** — copy the config object
3. Enable **Firestore Database** in test mode (or set proper rules)
4. Open FinTracker → **Settings → Firebase Sync** → paste your config

### Recommended Firestore security rules

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Restrict to authenticated users in production
    // For personal use, you can lock to your own UID:
    match /{collection}/{document} {
      allow read, write: if true; // ← replace with auth rules for production
    }
  }
}
```

### Sync QR Code

After connecting Firebase on desktop, go to **Settings → Sync QR Code** and scan with your phone. The QR encodes your Firebase config as a URL parameter — your phone opens the app with Firebase already connected, no typing required.

> ⚠️ The QR contains your Firebase API key. Only share with your own devices.

## PWA install

| Platform | Steps |
|---|---|
| iOS Safari | Share button → Add to Home Screen |
| Android Chrome | ⋮ menu → Add to Home Screen |
| Desktop Chrome / Edge | Install icon in the address bar |

## File structure

```
fintracker/
├── .github/workflows/deploy.yml   # GitHub Pages CI/CD
├── public/
│   ├── manifest.json              # PWA manifest
│   └── sw.js                      # Service worker (cache-first)
├── src/
│   ├── main.tsx                   # Entry point
│   ├── App.tsx                    # Shell: sidebar + bottom nav
│   ├── types.ts                   # All TypeScript interfaces
│   ├── db/indexedDB.ts            # Raw IDB primitives
│   ├── repositories/
│   │   ├── BaseRepository.ts      # Generic CRUD
│   │   └── index.ts               # Entity repo singletons
│   ├── sync/
│   │   ├── SyncAdapter.ts         # Abstract base + RestSyncAdapter
│   │   ├── FirebaseSyncAdapter.ts # Firestore real-time adapter
│   │   └── syncQueue.ts           # Offline-first change queue
│   ├── context/AppContext.tsx     # React context + reducer
│   ├── utils/
│   │   ├── id.ts                  # generateId()
│   │   ├── format.ts              # fmt, fmtDate, addDays…
│   │   ├── forecast.ts            # buildForecast()
│   │   └── pwa.ts                 # registerServiceWorker()
│   ├── qr/qrcode.ts               # Pure-TS QR encoder (no deps)
│   └── components/
│       ├── ui/
│       │   ├── tokens.ts          # Design tokens (colours, fonts)
│       │   ├── primitives.tsx     # Card, Btn, FInput, KpiCard…
│       │   └── Modal.tsx          # Bottom-sheet modal
│       ├── charts/index.tsx       # ForecastChart, SpendingDonut…
│       ├── forms/index.tsx        # One form per entity
│       └── views/
│           ├── EntityView.tsx     # CRUD scaffold shared by all views
│           ├── DashboardView.tsx
│           ├── ExpensesView.tsx
│           ├── AccountsView.tsx
│           ├── IncomeView.tsx
│           ├── RecurringView.tsx
│           ├── LoansView.tsx
│           ├── CreditCardsView.tsx
│           ├── InvestmentsView.tsx
│           ├── ForecastView.tsx
│           ├── SimulatorView.tsx
│           └── SettingsView.tsx
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Adding a custom sync backend

Extend `SyncAdapter` and register it:

```ts
import { SyncAdapter, registerSyncAdapter } from "@/sync";

class MyBackend extends SyncAdapter {
  async pushChanges(changes) { /* ... */ return { synced: [...], failed: [] }; }
  async pullEntity(entity)   { /* ... */ return []; }
}

registerSyncAdapter(new MyBackend());
```
