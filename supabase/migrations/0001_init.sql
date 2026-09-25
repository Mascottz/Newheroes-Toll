-- ============================================================================
-- NEWHEROES GROUP — Toll Gate Management System
-- Supabase migration 0001_init.sql
--
-- Run this ONCE in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- or via:  supabase db push
--
-- Creates: profiles (staff accounts + roles), vehicle_types (pricing),
-- settings (night surcharge), tickets (transactions), a daily ticket counter,
-- security-definer RPCs for offline-safe ticket creation & revenue reports,
-- and Row Level Security policies for role-based access.
-- ============================================================================

begin;

create extension if not exists pgcrypto;

-- ============================================================================
-- PROFILES — one row per authenticated user (created automatically by trigger)
-- ============================================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text        not null default '',
  full_name  text        not null default '',
  role       text        not null default 'staff' check (role in ('staff', 'admin')),
  is_active  boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Helper: is the current caller an ACTIVE admin?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and is_active
  );
$$;

-- Everyone can read their own profile; admins can read all profiles.
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

-- Only admins can change profiles (roles, activation status).
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Auto-create a profile whenever a user is created (via dashboard OR the
-- manage-user edge function). full_name and role come from user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'staff'), '@', 1)),
    case new.raw_user_meta_data ->> 'role'
      when 'admin' then 'admin'
      else 'staff'
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- SETTINGS — key/value app configuration (night parking surcharge)
-- ============================================================================
create table if not exists public.settings (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

create policy "settings_read_authenticated"
  on public.settings for select
  to authenticated
  using (true);

create policy "settings_write_admin"
  on public.settings for update
  using (public.is_admin())
  with check (public.is_admin());

insert into public.settings (key, value) values ('night_surcharge', '1000')
on conflict (key) do nothing;

-- ============================================================================
-- VEHICLE TYPES — authoritative pricing (editable by admins in Table Editor)
-- ============================================================================
create table if not exists public.vehicle_types (
  code        text primary key,
  label       text    not null,
  base_amount integer not null check (base_amount >= 0),
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.vehicle_types enable row level security;

create policy "vehicle_types_read_authenticated"
  on public.vehicle_types for select
  to authenticated
  using (true);

create policy "vehicle_types_write_admin"
  on public.vehicle_types for all
  using (public.is_admin())
  with check (public.is_admin());

insert into public.vehicle_types (code, label, base_amount, sort_order) values
  ('bike',  'Bike / Okada',      200, 1),
  ('car',   'Car',               300, 2),
  ('bus',   'Bus',               500, 3),
  ('dyna',  'Dyna / J5',        1000, 4),
  ('lorry', 'Lorry',            3000, 5),
  ('truck', 'Truck / Trailer',  5000, 6)
on conflict (code) do nothing;

-- ============================================================================
-- TICKETS — immutable transaction log
-- ============================================================================
create table if not exists public.tickets (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid  not null unique,          -- idempotency key from the device
  ticket_no     text  not null unique,          -- e.g. NH-260925-0042
  vehicle_code  text  not null references public.vehicle_types (code),
  vehicle_label text  not null,                 -- label frozen at issue time
  base_amount   integer not null check (base_amount >= 0),
  night_parking boolean not null default false,
  surcharge     integer not null default 0,
  total_amount  integer not null check (total_amount >= 0),
  issued_by     uuid    not null references auth.users (id) on delete cascade,
  issued_at     timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

create index if not exists tickets_issued_at_idx    on public.tickets (issued_at desc);
create index if not exists tickets_issued_by_idx    on public.tickets (issued_by, issued_at desc);
create index if not exists tickets_vehicle_code_idx on public.tickets (vehicle_code);

alter table public.tickets enable row level security;

-- Staff can read only their own tickets; admins can read everything.
create policy "tickets_select_own"
  on public.tickets for select
  using (issued_by = auth.uid());

create policy "tickets_select_admin"
  on public.tickets for select
  using (public.is_admin());

-- Staff can insert only their own tickets (the app normally uses the
-- create_ticket RPC, which recomputes amounts server-side).
create policy "tickets_insert_own"
  on public.tickets for insert
  with check (issued_by = auth.uid());

-- Deliberately NO update/delete policies: the transaction history is immutable.

-- Daily counter for ticket numbers (only security-definer functions touch it).
create table if not exists public.daily_ticket_counters (
  counter_date date   primary key,
  last_no      integer not null default 0
);

alter table public.daily_ticket_counters enable row level security;

-- ============================================================================
-- RPC: next_ticket_no(day) — atomically increments the daily counter
-- ============================================================================
create or replace function public.next_ticket_no(p_day date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_no integer;
begin
  insert into public.daily_ticket_counters (counter_date, last_no)
  values (p_day, 1)
  on conflict (counter_date)
  do update set last_no = public.daily_ticket_counters.last_no + 1
  returning last_no into v_no;
  return v_no;
end;
$$;

-- ============================================================================
-- RPC: create_ticket — offline-safe, idempotent ticket creation.
-- The SERVER recomputes all amounts from vehicle_types + settings, so a
-- tampered client cannot write wrong prices. If two devices picked the same
-- ticket number while offline, the second one is re-numbered automatically.
-- ============================================================================
create or replace function public.create_ticket(
  p_client_id     uuid,
  p_ticket_no     text,
  p_vehicle_code  text,
  p_night_parking boolean,
  p_issued_at     timestamptz
)
returns public.tickets
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     uuid := auth.uid();
  v_profile  public.profiles;
  v_vehicle  public.vehicle_types;
  v_surcharge integer;
  v_no       text := upper(p_ticket_no);
  v_day      date;
  v_ticket   public.tickets;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_user;
  if not found or not v_profile.is_active then
    raise exception 'Account is inactive or has no profile';
  end if;

  -- Idempotent replay: if this device already synced this ticket, return it.
  select * into v_ticket from public.tickets where client_id = p_client_id;
  if v_ticket.id is not null then
    return v_ticket;
  end if;

  select * into v_vehicle from public.vehicle_types
   where code = p_vehicle_code and is_active;
  if not found then
    raise exception 'Unknown vehicle type: %', p_vehicle_code;
  end if;

  if p_night_parking then
    select coalesce(max(value::int), 1000) into v_surcharge
      from public.settings where key = 'night_surcharge';
  else
    v_surcharge := 0;
  end if;

  v_day := (p_issued_at at time zone 'Africa/Lagos')::date;

  begin
    insert into public.tickets
      (client_id, ticket_no, vehicle_code, vehicle_label, base_amount,
       night_parking, surcharge, total_amount, issued_by, issued_at)
    values
      (p_client_id, v_no, v_vehicle.code, v_vehicle.label, v_vehicle.base_amount,
       p_night_parking, v_surcharge, v_vehicle.base_amount + v_surcharge, v_user, p_issued_at)
    returning * into v_ticket;
  exception
    when unique_violation then
      -- Another device already used this ticket number (offline collision).
      -- If the race was on client_id (double-tap retry), just return the row.
      select * into v_ticket from public.tickets where client_id = p_client_id;
      if v_ticket.id is not null then
        return v_ticket;
      end if;
      v_no := 'NH-' || to_char(v_day, 'YYMMDD') || '-' ||
              lpad(public.next_ticket_no(v_day)::text, 4, '0');
      insert into public.tickets
        (client_id, ticket_no, vehicle_code, vehicle_label, base_amount,
         night_parking, surcharge, total_amount, issued_by, issued_at)
      values
        (p_client_id, v_no, v_vehicle.code, v_vehicle.label, v_vehicle.base_amount,
         p_night_parking, v_surcharge, v_vehicle.base_amount + v_surcharge, v_user, p_issued_at)
      returning * into v_ticket;
  end;

  return v_ticket;
end;
$$;

-- ============================================================================
-- RPC: revenue_report(from, to, staff) — aggregated analytics for the dashboard
-- Non-admins are always restricted to their own tickets, regardless of args.
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
  v_staff     uuid := p_staff;
  v_is_admin  boolean := public.is_admin();
  v_totals    record;
  v_night     record;
  v_by_vehicle json;
  v_by_staff   json;
  v_by_day     json;
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

  return json_build_object(
    'from', p_from,
    'to', p_to,
    'totalRevenue', v_totals.revenue,
    'totalTickets', v_totals.tickets,
    'nightTickets', v_night.tickets,
    'nightRevenue', v_night.revenue,
    'byVehicle', v_by_vehicle,
    'byStaff', v_by_staff,
    'byDay', v_by_day
  );
end;
$$;

revoke execute on function public.create_ticket(uuid, text, text, boolean, timestamptz) from anon, public;
grant  execute on function public.create_ticket(uuid, text, text, boolean, timestamptz) to authenticated;

revoke execute on function public.revenue_report(timestamptz, timestamptz, uuid) from anon, public;
grant  execute on function public.revenue_report(timestamptz, timestamptz, uuid) to authenticated;

revoke execute on function public.next_ticket_no(date) from anon, public, authenticated;

-- ============================================================================
-- REALTIME — live dashboard updates when new tickets are issued
-- ============================================================================
do $$
begin
  alter publication supabase_realtime add table public.tickets;
exception
  when duplicate_object then null; -- already in the publication
end $$;

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end $$;

commit;

-- ============================================================================
-- DONE. Next steps (see docs/SUPABASE_SETUP.md):
--   1. Create your first user in Authentication → Users → Add user.
--   2. Promote them to admin:
--        update public.profiles set role = 'admin' where email = 'you@example.com';
--   3. Deploy the manage-user edge function for in-app staff management.
-- ============================================================================
