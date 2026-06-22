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
  lib/supabase.js        Supabase client (reads VITE_SUPABASE_* env)
  lib/useLocalStorage.js persisted-state hook (drafts)
  store/captureStore.js  real Supabase queries: fetch / insert / delete captures
  auth/                  AuthProvider, RequireAuth route guard
  components/            TopBar (nav + account) + small UI primitives
  pages/                 one file per screen + Login + admin/
  store/adminStore.js    vendor-admin queries (hotels, agents, invite)
  auth/                  AuthProvider, RequireAuth, RequireVendor
  App.jsx, main.jsx      router + entry
supabase/
  migrations/0001_init.sql  schema + RLS policies
  migrations/0002_admin.sql soft-delete + vendor management policies
  functions/invite-agent/   edge function: server-side agent invite
  seed.sql                  demo hotels + linking instructions
```

## Backend (Supabase)

Postgres + Auth + Row Level Security. Tables: `hotels`, `agents`, `captures`
(+ `vendor_admins`).

- **Tenancy via RLS.** A signed-in auth user is matched to an `agents` row by
  email; they can only read/write their own hotel's data. Emails listed in
  `vendor_admins` get cross-hotel (vendor) read access for reconciliation.
- Policies use `SECURITY DEFINER` helpers (`is_vendor()`, `current_hotel_id()`)
  so they don't recurse into the tables they protect.
- **Soft delete.** `hotels.active` / `agents.active` flags; select policies hide
  inactive rows from agents (vendors still see them). A deactivated agent is
  fully locked out — `current_hotel_id()` only resolves for active agents.

### Vendor admin panel (`/admin`)

Gated to vendor admins (`RequireVendor`); everyone else is redirected to `/`.
Manage hotels (add / inline-edit / deactivate) and their agents
(`/admin/hotels/:hotelId`). Adding an agent inserts the `agents` row and sends a
password-setup invite; admins can also **reset an agent's password** directly.

> **Security:** the `auth.admin.*` calls require the **service-role key** and must
> never run in the browser. They live in edge functions (service role stays
> server-side; each verifies the caller is a vendor admin):
>
> - `invite-agent` — `inviteUserByEmail` (email invite)
> - `reset-agent-password` — `updateUserById` (set a password directly)
>
> ```bash
> supabase functions deploy invite-agent
> supabase functions deploy reset-agent-password
> supabase secrets set SERVICE_ROLE_KEY=<your-service-role-key>
> ```

### One-time setup

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql`, `0002_admin.sql`, then `0003_reset_password.sql`
   in the SQL editor (or `supabase db push`).
3. Optionally run `supabase/seed.sql` for demo hotels.
4. Add vendor emails to `vendor_admins`, sign in, and provision hotels/agents from
   `/admin`. (Or seed `agents` rows manually — email must match the auth user.)
5. Deploy the invite function: `supabase functions deploy invite-agent`.
6. Copy `.env.example` → `.env` and set `VITE_SUPABASE_URL` /
   `VITE_SUPABASE_ANON_KEY`. **Credentials come from env only — never hardcoded.**

## Develop

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL + anon key
npm run dev            # local dev server (http://localhost:5173)
npm run build          # production build → dist/
npm run preview        # preview the production build
```

> Routing uses `BrowserRouter`. When deploying the static `dist/` build (e.g.
> Vercel), configure an SPA fallback so deep links resolve to `index.html`.
