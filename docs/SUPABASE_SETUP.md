# Supabase Setup Guide

Step-by-step to move NEWHEROES Toll Gate from demo mode to production.

---

## 1. Create the project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Name it (e.g. `newheroes-toll`), choose a strong DB password and the region
   closest to Abuja (e.g. `eu-west`).
3. When the project is ready, note the **Project URL** and **anon public key**
   from *Project Settings → API* — you'll need them in step 6.

## 2. Create the database schema

1. In the dashboard open **SQL Editor → New query**.
2. Paste the entire contents of
   [`supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql)
   and click **Run**.
3. Then paste
   [`supabase/migrations/0002_analytics.sql`](../supabase/migrations/0002_analytics.sql)
   and **Run** it too — it adds the `expenses` table, the `expense_summary`
   RPC (used by the KPI cards & report exports) and monthly aggregation for
   the revenue-trend chart.
4. You should see “Success. No rows returned”. Together the migrations created:
   - `profiles`, `vehicle_types`, `settings`, `tickets`, `expenses`,
     `daily_ticket_counters`
   - Row Level Security policies (staff see only their own tickets;
     expenses are admin-only)
   - `create_ticket` + `revenue_report` + `expense_summary` RPCs
     (server-side pricing & analytics)
   - A trigger that auto-creates a profile for every new auth user
   - Realtime publication entries for live dashboard updates

## 3. Create your first Manager (admin) account

1. Go to **Authentication → Users → Add user**.
2. Enter your email + password, enable **Auto Confirm User**, click *Create*.
3. The trigger created a **staff** profile. Promote yourself — in **SQL Editor**:

   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```

## 4. Deploy the `manage-user` Edge Function

This powers **Add staff / Reset password / Deactivate** inside the app.

**Option A — Supabase CLI (recommended)**

```bash
npm install -g supabase   # if you don't have it
supabase login
# from the project root:
supabase functions deploy manage-user --project-ref YOUR_PROJECT_REF
```

**Option B — Dashboard**

1. Go to **Edge Functions → New function**, name it `manage-user`.
2. Paste the contents of
   [`supabase/functions/manage-user/index.ts`](../supabase/functions/manage-user/index.ts).
3. Deploy.

No secrets configuration needed — `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

> If you skip this step the app still works; managers just can't create staff
> from inside the app (they'd use *Authentication → Users* in the dashboard
> instead — the trigger still builds their profile).

## 5. Recommended auth settings

- **Authentication → Providers → Email**: keep enabled.
- **Authentication → Sign In / Up → Confirm email**: OFF is fine — accounts are
  created by the manager and pre-confirmed.
- Optionally restrict password length (≥ 6) — already enforced in the app UI.

## 6. Connect the frontend

```bash
cp .env.example .env
```

Fill in:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...     # Settings → API → anon public
```

Then:

```bash
npm run build      # outputs dist/
```

The login screen will no longer show the demo banner — you're live.

## 7. Host it (HTTPS is required for PWA install/offline)

**Vercel** — import the repo; `vercel.json` (included) handles SPA routing. Add
the two `VITE_…` env variables in project settings.

**Netlify** — build command `npm run build`, publish directory `dist`;
`public/_redirects` (included) handles SPA routing. Add the env vars.

**Any static host / VPS** — upload `dist/` behind HTTPS (nginx, cPanel, etc.).

Then on each attendant's phone: open the URL → login → **Install app**
(or iOS: Share → Add to Home Screen).

## 8. Day-to-day operations

| Task | How |
|---|---|
| Monitor live operations | Admin → **Car Park Analytics** (KPIs, charts, live feed) |
| Audit a specific attendant | Admin → **Detailed Reports** → staff dropdown |
| Export a report | **Detailed Reports** or **Car Park Analytics** → PDF / Word / CSV buttons |
| Record an expense (fuel, repairs…) | Admin → **Expenses** → “Record expense” |
| End-of-day cash balancing | Admin → **Daily Balancing** → pick date → print sheet |
| Add / deactivate staff, reset passwords | Admin → **Staff Management** |
| Change a vehicle price | Supabase **Table Editor → vehicle_types** → edit `base_amount`. Apps pick it up on next sync |
| Change night surcharge | **Table Editor → settings** → `night_surcharge` value (naira) |
| Add a vehicle category | Insert a row in `vehicle_types` (`code`, `label`, `base_amount`, `sort_order`) |

## 9. Verify everything works

1. **Online flow:** sign in as manager → Reports shows live totals. Issue a
   ticket as staff in another browser — the dashboard updates in realtime.
2. **Offline flow:** phone in airplane mode → issue a ticket (works, shows
   “saves when online”) → reconnect → it uploads and appears in reports.
3. **Security spot-checks:**
   - Sign in as staff → they only see their own tickets and no Staff/Reports tabs.
   - Run in SQL editor as a sanity check of totals:
     ```sql
     select count(*), sum(total_amount) from public.tickets
     where issued_at::date = current_date;
     ```

## Troubleshooting

| Symptom | Fix |
|---|---|
| “manage-user Edge Function may not be deployed” | Deploy it (step 4) or manage users via the dashboard |
| New staff can't see prices / issues empty | They must sign in once online; also confirm `vehicle_types` has rows |
| Ticket numbers jump (e.g. 0007 → 0009) | Normal: numbers come from a server counter; offline devices may renumber on sync to avoid duplicates |
| Dashboard empty but tickets exist | Check the date range filter, and that the app has the correct Supabase URL |
| SW serving an old version after deploy | Bump `CACHE_VERSION` in `public/sw.js` and redeploy |
