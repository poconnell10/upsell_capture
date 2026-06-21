Upsell Capture

Front-desk module for capturing room upgrades and ancillary ("other revenue")
sales against a booking, and reporting on what agents have sold.

Built from the four interactive prototypes as a single **Vite + React** app.

## Screens

| Route      | Screen          | What it does |
|------------|-----------------|--------------|
| `/`        | **Agent Sales** | Dashboard of captured upsells — line items, per-agent rollup, KPIs, CSV export, quick-capture modal. |
| `/capture` | **Capture Sale**| The core flow: confirmation + agent, room upgrade (rate delta × nights), other-revenue add-ons, drafts, duplicate/oversell guards, confirm & capture. |
| `/rooms`   | **Rooms & Rates**| Base room products with brand-inherit / property-override, inline rate edit, availability (no-oversell) and rate plans. |
| `/other`   | **Other Revenue**| Per-product tax (exclusive/inclusive) and property fees, with a live worked-example calculator. |

## How it fits together

- **`src/data/catalog.js`** is the single source of truth for rooms, rates,
  inventory, other-revenue products, agents, rate plans and tax defaults. The
  prototypes each carried their own copy; that data now lives in one place.
- **Captured sales are shared.** `src/store/captures.jsx` holds them (persisted
  to `localStorage`); a sale captured on **Capture Sale** shows up as line items
  on the **Agent Sales** dashboard.
- Availability (`total − sold`) drives the oversell guard in Capture Sale.

## Project layout

```
src/
  data/catalog.js        shared product / agent / tax data
  lib/format.js          money, $5 rounding, date labels
  lib/useLocalStorage.js persisted-state hook
  store/captures.jsx     shared captured-sales store + context
  components/             TopBar (nav) + small UI primitives
  pages/                  one file per screen
  App.jsx, main.jsx      router + entry
```

## Develop

```bash
npm install
npm run dev      # local dev server (http://localhost:5173)
npm run build    # production build → dist/
npm run preview  # preview the production build
```

> Routing uses `BrowserRouter`. When deploying the static `dist/` build, configure
> the host to serve `index.html` for unknown paths (SPA fallback) so deep links work.
