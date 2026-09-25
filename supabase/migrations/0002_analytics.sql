-- ============================================================================
-- NEWHEROES Toll — migration 0002_analytics.sql
--
-- Adds the pieces required by the Car Park Analytics dashboard:
--   • `expenses` table (admin-managed operational expenses) + RLS
--   • `expense_summary(from, to)` RPC for KPIs & report exports
--   • `revenue_report` v2 — now also returns `byMonth` for the yearly trend
--
-- Run AFTER 0001_init.sql (in the Supabase SQL Editor or via db push).
-- ============================================================================

begin;

-- ============================================================================
-- EXPENSES — manual operational expenses recorded by managers
-- ============================================================================
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  description text        not null,
  category    text        not null default 'Other',
  amount      integer     not null check (amount > 0),
  incurred_at date        not null default current_date,
  recorded_by uuid        not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists expenses_incurred_at_idx on public.expenses (incurred_at desc);

alter table public.expenses enable row level security;

-- Only managers can see, record or remove expenses.
create policy "expenses_select_admin"
  on public.expenses for select
  using (public.is_admin());

create policy "expenses_insert_admin"
  on public.expenses for insert
  with check (public.is_admin());

create policy "expenses_delete_admin"
  on public.expenses for delete
  using (public.is_admin());

-- ============================================================================
-- RPC: expense_summary(from, to) — totals + per-category breakdown.
-- `p_to` is EXCLUSIVE (pass tomorrow's date for "today").
-- ============================================================================
create or replace function public.expense_summary(p_from date, p_to date)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  return (
    select json_build_object(
      'total', coalesce(sum(amount), 0),
      'count', count(*),
      'byCategory', coalesce((
        select json_agg(row_to_json(c) order by c.amount desc)
        from (
          select category, count(*) as count, sum(amount) as amount
          from public.expenses
          where incurred_at >= p_from and incurred_at < p_to
          group by category
        ) c
      ), '[]'::json)
    )
    from public.expenses
    where incurred_at >= p_from and incurred_at < p_to
  );
end;
$$;

revoke execute on function public.expense_summary(date, date) from anon, public;
grant  execute on function public.expense_summary(date, date) to authenticated;

-- ============================================================================
-- RPC: revenue_report v2 — same contract as v1 plus `byMonth`
-- (used by the yearly revenue trend chart).
-- ============================================================================
create or replace function public.revenue_report(
  p_from  timestamptz,
  p_to    timestamptz,
  p_staff uuid default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_staff      uuid := p_staff;
  v_is_admin   boolean := public.is_admin();
  v_totals     record;
  v_night      record;
  v_by_vehicle json;
  v_by_staff   json;
  v_by_day     json;
  v_by_month   json;
begin
  if not v_is_admin then
    v_staff := auth.uid();
  end if;

  select coalesce(sum(total_amount), 0) as revenue, count(*) as tickets
    into v_totals
  from public.tickets
  where issued_at >= p_from and issued_at < p_to
    and (v_staff is null or issued_by = v_staff);

  select coalesce(sum(total_amount), 0) as revenue, count(*) as tickets
    into v_night
  from public.tickets
  where issued_at >= p_from and issued_at < p_to
    and night_parking
    and (v_staff is null or issued_by = v_staff);

  select coalesce(json_agg(row_to_json(v) order by v.revenue desc), '[]'::json)
    into v_by_vehicle
  from (
    select vehicle_code as code, vehicle_label as label,
           count(*) as tickets, sum(total_amount) as revenue
    from public.tickets
    where issued_at >= p_from and issued_at < p_to
      and (v_staff is null or issued_by = v_staff)
    group by vehicle_code, vehicle_label
  ) v;

  if v_is_admin then
    select coalesce(json_agg(row_to_json(s) order by s.revenue desc), '[]'::json)
      into v_by_staff
    from (
      select p.id as staff_id, p.full_name as staff_name,
             count(t.id) as tickets, coalesce(sum(t.total_amount), 0) as revenue
      from public.profiles p
      left join public.tickets t
        on t.issued_by = p.id
       and t.issued_at >= p_from and t.issued_at < p_to
      group by p.id, p.full_name
    ) s;
  else
    v_by_staff := '[]'::json;
  end if;

  select coalesce(json_agg(row_to_json(d) order by d.day), '[]'::json)
    into v_by_day
  from (
    select to_char((issued_at at time zone 'Africa/Lagos')::date, 'YYYY-MM-DD') as day,
           count(*) as tickets, sum(total_amount) as revenue
    from public.tickets
    where issued_at >= p_from and issued_at < p_to
      and (v_staff is null or issued_by = v_staff)
    group by 1
  ) d;

  select coalesce(json_agg(row_to_json(m) order by m.month), '[]'::json)
    into v_by_month
  from (
    select to_char((issued_at at time zone 'Africa/Lagos')::date, 'YYYY-MM') as month,
           count(*) as tickets, sum(total_amount) as revenue
    from public.tickets
    where issued_at >= p_from and issued_at < p_to
      and (v_staff is null or issued_by = v_staff)
    group by 1
  ) m;

  return json_build_object(
    'from', p_from,
    'to', p_to,
    'totalRevenue', v_totals.revenue,
    'totalTickets', v_totals.tickets,
    'nightTickets', v_night.tickets,
    'nightRevenue', v_night.revenue,
    'byVehicle', v_by_vehicle,
    'byStaff', v_by_staff,
    'byDay', v_by_day,
    'byMonth', v_by_month
  );
end;
$$;

commit;
