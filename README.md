# Newheroes Toll — Dutse Market

A **mobile-first, offline-capable PWA** for toll-gate ticketing and **Car Park
Analytics**, built for **NEWHEROES GROUP** at the Olajumoke Arcade Shopping
Arcade, Dutse, Abuja.

| | |
|---|---|
| **Frontend** | React 18 + Vite + Tailwind CSS (mobile-first, thumb-friendly) |
| **Charts** | Recharts — responsive revenue trend & vehicle-mix visualisations |
| **Exports** | PDF (jsPDF) and Word `.docx` (docx) reports + CSV |
| **Backend** | Supabase (Postgres + Auth + Row Level Security + Realtime + Edge Functions) |
| **PWA** | Web Manifest + Service Worker — installable, works offline |
| **Deploy** | GitHub → Vercel (config included) |

> All tracking is based on **manual ticket entries** and standard database
> queries — no RFID, e-tag or automated gate scanning of any kind.

---

## ✨ Features

### Toll operations (attendants)
- Rapid-entry dashboard: tap a vehicle, tap issue. Bike ₦200 · Car ₦300 ·
  Bus ₦500 · Dyna/J5 ₦1,000 · Lorry ₦3,000 · Truck/Trailer ₦5,000.
- **Night Parking toggle** adds the ₦1,000 surcharge automatically.
- Digital receipt mimicking the physical tickets (pink & white, red text,
  badge logo, exact wording) with Print & Share.
- **My Sales**: personal daily records with CSV export.

### Car Park Analytics (managers) — `/admin`
- **Distinct admin layout** with a sidebar (desktop) + drawer & bottom quick
  nav (mobile). Header: “Car Park Analytics — NEWHEROES GROUP - Dutse Modern
  Market Car Park Monitoring System”.
- **KPI cards**: Today's Revenue, Total Year Revenue, Current Active Staff
  (registered / on shift), Total Vehicles Today, Expenses, Net (Today).
- **Monthly Revenue Trend** chart (bar) — toggle daily (current month) or
  monthly (current year).
- **Ticket Distribution** doughnut — vehicle mix for Today/Week/Month/Year.
- **Recent Activity feed** — scrollable live transaction ledger (time, vehicle,
  amount, staff, night status) updating in real time as staff issue tickets.
- **Detailed Reports** — period & staff filters, vehicle breakdown, staff
  performance, expenses, ticket ledger — exportable as **PDF, Word (.docx) or
  CSV**, all cleanly formatted with the NEWHEROES brand.
- **Daily Balancing** — per-attendant collections, printable signature sheet.
- **Expenses** — manual expense ledger (fuel, maintenance, salaries…) with
  today/month/year summaries and category breakdown.
- **Staff Management** — create accounts, reset passwords, deactivate staff.

### Offline-first & security
- Tickets are stored on-device first and sync via an **idempotent** RPC when
  online; offline ticket-number collisions are renumbered server-side.
- All amounts are **recomputed server-side** — modified clients can't post
  wrong prices. Row Level Security throughout; history is immutable.
- Realtime updates via Supabase channels (and cross-tab in demo mode).

---

## 🚀 Quick start (Demo Mode — no backend needed)

```bash
npm install
npm run dev        # → http://localhost:5173
```

Without Supabase credentials the app runs in **local demo mode** with seeded
accounts, ~6 days of sample tickets and sample expenses:

| Account | Password | Role |
|---|---|---|
| `manager@newheroes.ng` | `manager123` | Manager (admin) |
| `musa@newheroes.ng` | `staff123` | Attendant |
| `hauwa@newheroes.ng` | `staff123` | Attendant |
| `chidi@newheroes.ng` | `staff123` | Attendant (deactivated example) |

The login screen has one-tap buttons for each demo account.

### Test the PWA offline

```bash
npm run build
npm run preview     # → http://localhost:4173
```
Install the app (Chrome/Edge), turn on airplane mode, reload — the app still
starts and tickets still issue. Reconnect and everything syncs.

---

## 🔐 Production setup (Supabase)

Full guide: **[docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md)**. Summary:

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` **and**
   `supabase/migrations/0002_analytics.sql` in the SQL Editor.
3. Create your first user, then promote them:
   `update public.profiles set role = 'admin' where email = 'you@example.com';`
4. Deploy the admin edge function: `supabase functions deploy manage-user`
5. Copy `.env.example` → `.env` with your project URL + anon key.
6. `npm run build` and host `dist/` on any HTTPS static host.

---

## ☁️ Deploy to GitHub → Vercel

```bash
git init
git add .
git commit -m "Newheroes Toll — toll gate ticketing & Car Park Analytics"
git branch -M main
git remote add origin https://github.com/<you>/newheroes-toll.git
git push -u origin main
```

Then on **vercel.com**: *Add New → Project → Import* the repo. Vercel
auto-detects Vite (`npm run build`, output `dist/`). Under
**Settings → Environment Variables** add:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://YOUR-PROJECT-REF.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | your anon public key |

Click **Deploy**. `vercel.json` (SPA rewrites) is already included. Every
`git push` to `main` redeploys automatically.

> Don't forget to add the same variables in Vercel's *Preview* environment if
> you want preview deployments to hit your real backend.

---

## 📁 Project structure

```
├── public/
│   ├── manifest.webmanifest      # PWA manifest ("Newheroes Toll")
│   ├── sw.js                     # Service worker (app-shell caching)
│   ├── brand/logo.png            # Official NEWHEROES GROUP logo
│   └── icons/                    # Generated PWA icons (npm run icons)
├── supabase/
│   ├── migrations/
│   │   ├── 0001_init.sql         # Core schema + RLS + RPCs
│   │   └── 0002_analytics.sql    # Expenses + byMonth analytics
│   └── functions/manage-user/    # Edge function for staff management
├── scripts/gen-icons.js          # Regenerates PNG icons from the badge SVG
└── src/
    ├── lib/
    │   ├── ticketClient.js       # Offline-first ticket store + sync + reports
    │   ├── expenseClient.js      # Expense ledger + summaries
    │   ├── authClient.js         # Auth + staff management (Supabase / demo)
    │   └── exporters/            # reportModel + PDF + Word generators
    ├── hooks/                    # useAuth, useTickets, useOnline, useDebounced
    ├── components/
    │   ├── admin/AdminLayout.jsx # Sidebar layout for the admin area
    │   ├── Receipt.jsx           # Digital receipt (print/share)
    │   └── ...
    └── pages/
        ├── Login, IssueTicket, MySales          # operations
        └── admin/                               # Car Park Analytics suite
            ├── AdminAnalytics.jsx               # KPIs + charts + live feed
            ├── AdminReports.jsx                 # filters + PDF/Word/CSV
            ├── AdminBalancing.jsx               # daily balancing sheets
            ├── AdminExpenses.jsx                # expense management
            └── StaffAdmin.jsx                   # staff accounts
```

## 🧾 Data model (Supabase)

- `profiles` — accounts, `role` = `staff | admin`, `is_active`.
- `vehicle_types` — pricing per vehicle code (editable, no code changes).
- `settings` — `night_surcharge` (default ₦1000).
- `tickets` — immutable transaction log (ticket no, vehicle, base+surcharge+total, user, timestamp).
- `expenses` — manual operational expenses (admin-only).
- `daily_ticket_counters` — gap-safe ticket numbering.

## 🛠 Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server (demo mode unless `.env` is set) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run icons` | Regenerate PWA icons from the badge SVG |
