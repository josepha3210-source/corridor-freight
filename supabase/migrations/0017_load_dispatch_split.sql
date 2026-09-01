-- Corridor Freight — Phase 3c: Load / Dispatch split
-- The v2 prompt's own words for this one: "the biggest schema change...
-- do it carefully." `loads` today is one table doing two jobs — the
-- commercial booking (who's the customer, what are they being charged)
-- and the operational execution (which truck/driver, where it's going,
-- has it been delivered). This migration splits those into `loads`
-- (booking-side, kept) and two new tables: `dispatches` (operational —
-- driver, status, driver pay, delivery proof) and `load_stops`
-- (multi-stop support — today always exactly one pickup + one dropoff
-- per dispatch, but a real table instead of two flat columns so a
-- future multi-stop route doesn't need another schema migration).
--
-- "Carefully" here means: every existing load becomes exactly one
-- dispatch row (never zero, never many) via a straight backfill before
-- anything is dropped, and a compatibility view
-- (`loads_with_dispatch`) reproduces the old flat row shape so the
-- read-heavy consumers (dashboard aggregates, list pages, driver
-- portal) don't each need a bespoke rewrite of their join logic — only
-- the handful of places that actually WRITE operational data (create,
-- edit, status changes, delivery confirmation) change what table they
-- target. This is a real split (the old columns are genuinely dropped
-- from `loads` at the end, not just deprecated in place) — the view is
-- a read convenience, not a crutch that lets two sources of truth
-- silently drift.

-- ============================================================================
-- dispatches — one row per truck/driver actually executing a load
-- ============================================================================

create table public.dispatches (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  load_id        uuid not null references public.loads (id) on delete cascade,

  driver_id      uuid references public.drivers (id) on delete set null,
  status         text not null default 'unassigned'
                    check (status in ('unassigned', 'assigned', 'in_transit', 'delivered', 'cancelled')),

  -- what the driver earns — client_rate (what the customer's charged)
  -- stays on `loads`, the booking side.
  driver_pay     numeric(10, 2) not null default 0 check (driver_pay >= 0),

  -- e-signature capture at delivery — unchanged from the old
  -- `loads` columns of the same name, just relocated.
  signed_by_name text,
  signature_data text,
  delivered_at   timestamptz,

  created_at     timestamptz not null default now()
);

create index dispatches_company_id_idx on public.dispatches (company_id);
create index dispatches_load_id_idx    on public.dispatches (load_id);
create index dispatches_driver_id_idx  on public.dispatches (driver_id);

-- ============================================================================
-- load_stops — pickup/dropoff (and, later, any additional stop) for a
-- dispatch. company_id is denormalized here rather than joining through
-- dispatches for every RLS check — same reasoning 0016 used for
-- trucks/contacts carrying their own company_id directly.
-- ============================================================================

create table public.load_stops (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  dispatch_id  uuid not null references public.dispatches (id) on delete cascade,

  stop_type    text not null check (stop_type in ('pickup', 'dropoff')),
  sequence     integer not null,
  location     text not null,
  scheduled_at timestamptz,

  created_at   timestamptz not null default now()
);

create index load_stops_company_id_idx  on public.load_stops (company_id);
create index load_stops_dispatch_id_idx on public.load_stops (dispatch_id);

-- ============================================================================
-- backfill — every existing load becomes exactly one dispatch, and its
-- pickup_location/pickup_at/dropoff_location/dropoff_at become two
-- load_stops rows. Runs before anything is dropped from `loads`.
-- ============================================================================

insert into public.dispatches (
  id, company_id, load_id, driver_id, status, driver_pay,
  signed_by_name, signature_data, delivered_at, created_at
)
select
  gen_random_uuid(), l.company_id, l.id, l.driver_id, l.status, l.driver_pay,
  l.signed_by_name, l.signature_data, l.delivered_at, l.created_at
from public.loads l;

insert into public.load_stops (company_id, dispatch_id, stop_type, sequence, location, scheduled_at)
select d.company_id, d.id, 'pickup', 1, l.pickup_location, l.pickup_at
from public.dispatches d
join public.loads l on l.id = d.load_id;

insert into public.load_stops (company_id, dispatch_id, stop_type, sequence, location, scheduled_at)
select d.company_id, d.id, 'dropoff', 2, l.dropoff_location, l.dropoff_at
from public.dispatches d
join public.loads l on l.id = d.load_id;

-- ============================================================================
-- loads — drop what moved. What's left is purely the booking record:
-- id, company_id, load_number, customer_id (0016), client_name,
-- client_rate, notes, created_at.
--
-- The two old driver-visibility policies (0006) have to be dropped
-- *before* the columns they reference (driver_id, status) — caught this
-- live: doing it in file order (columns first, policies dropped further
-- down where the new loads policy is introduced) fails with "cannot
-- drop column because other objects depend on it." Postgres won't let a
-- column go while a policy still references it, so the drop order here
-- is deliberately different from the read order below.
-- ============================================================================

drop policy "drivers can view their own assigned loads" on public.loads;
drop policy "drivers can advance their own assigned loads" on public.loads;

alter table public.loads
  drop column driver_id,
  drop column status,
  drop column pickup_location,
  drop column pickup_at,
  drop column dropoff_location,
  drop column dropoff_at,
  drop column driver_pay,
  drop column signed_by_name,
  drop column signature_data,
  drop column delivered_at;

-- ============================================================================
-- RLS — dispatches (mirrors the old operational policies loads had:
-- 0007's owner/dispatcher/admin CRUD, plus 0006's narrower driver
-- policies, transplanted onto the table that now actually owns these
-- columns)
-- ============================================================================

alter table public.dispatches enable row level security;

create policy "select own company dispatches"
  on public.dispatches for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "insert own company dispatches"
  on public.dispatches for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "update own company dispatches"
  on public.dispatches for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

-- Transplanted from 0006, unchanged in spirit: a driver sees only their
-- own assigned dispatch, on an active driver record in the same company.
create policy "drivers can view their own assigned dispatches"
  on public.dispatches for select
  using (
    exists (
      select 1 from public.drivers d
      where d.user_id = auth.uid()
        and d.id = dispatches.driver_id
        and d.company_id = dispatches.company_id
        and d.status = 'active'
    )
  );

-- Same narrowing as before: can't touch a dispatch that's already
-- terminal, and can only ever land on in_transit or delivered — never
-- cancelled, never back to unassigned, never reassigned.
create policy "drivers can advance their own assigned dispatches"
  on public.dispatches for update
  using (
    status not in ('delivered', 'cancelled')
    and exists (
      select 1 from public.drivers d
      where d.user_id = auth.uid()
        and d.id = dispatches.driver_id
        and d.company_id = dispatches.company_id
        and d.status = 'active'
    )
  )
  with check (
    status in ('in_transit', 'delivered')
    and exists (
      select 1 from public.drivers d
      where d.user_id = auth.uid()
        and d.id = dispatches.driver_id
        and d.company_id = dispatches.company_id
        and d.status = 'active'
    )
  );

-- Same past-due write-lock as loads/drivers (0014) — creating a new
-- dispatch is "new work" the same way a new load or driver is. In
-- practice create_load_with_dispatch() below inserts into `loads`
-- first, which already blocks under lockout before this ever fires —
-- this is defense-in-depth for any future direct insert path, same
-- "the UI gate isn't the real gate" reasoning as everywhere else this
-- trigger's used.
create trigger enforce_payment_write_lock_dispatches
  before insert on public.dispatches
  for each row
  execute function public.enforce_payment_write_lock();

-- ============================================================================
-- RLS — load_stops (same shape as dispatches: staff by company+role,
-- driver by owning the dispatch these stops belong to)
-- ============================================================================

alter table public.load_stops enable row level security;

create policy "select own company load stops"
  on public.load_stops for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "insert own company load stops"
  on public.load_stops for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "update own company load stops"
  on public.load_stops for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "drivers can view stops on their own assigned dispatches"
  on public.load_stops for select
  using (
    exists (
      select 1 from public.dispatches disp
      join public.drivers d on d.id = disp.driver_id
      where disp.id = load_stops.dispatch_id
        and d.user_id = auth.uid()
        and d.status = 'active'
    )
  );

-- ============================================================================
-- loads — the driver-visibility policy that used to live here (0006)
-- referenced driver_id/status, both already dropped above (had to
-- happen before the columns did, not here). Replaced with a policy
-- that reaches the same conclusion through dispatches: a driver can see
-- the booking record for a load they have a dispatch on.
-- ============================================================================

create policy "drivers can view loads they have a dispatch on"
  on public.loads for select
  using (
    exists (
      select 1 from public.dispatches disp
      join public.drivers d on d.id = disp.driver_id
      where disp.load_id = loads.id
        and d.user_id = auth.uid()
        and d.company_id = loads.company_id
        and d.status = 'active'
    )
  );

-- ============================================================================
-- loads_with_dispatch — read-compatibility view. Reproduces the old
-- flat `loads` row shape (one row per load, its current dispatch's
-- operational fields, and its two stops pivoted into pickup_*/
-- dropoff_* columns) so list/dashboard/portal pages that only ever
-- READ this shape don't need their query logic rebuilt — they just
-- point at this view instead of the bare `loads` table. It is not
-- security definer, so ordinary RLS on loads/dispatches/drivers/
-- load_stops applies exactly as if each table were queried directly —
-- a driver sees only their own row here, same as everywhere else.
--
-- Inner join on dispatches assumes the one-dispatch-per-load shape this
-- app currently builds and enforces (create_load_with_dispatch below is
-- the only path that creates a load, and it always creates exactly one
-- dispatch with it) — a future multi-dispatch-per-load feature would
-- need to revisit this view, not just add rows to dispatches.
-- ============================================================================

create view public.loads_with_dispatch as
select
  l.id,
  l.company_id,
  l.load_number,
  l.customer_id,
  l.client_name,
  l.client_rate,
  l.notes,
  l.created_at,
  disp.id as dispatch_id,
  disp.driver_id,
  drv.full_name as driver_name,
  disp.status,
  disp.driver_pay,
  disp.signed_by_name,
  disp.signature_data,
  disp.delivered_at,
  pickup.location as pickup_location,
  pickup.scheduled_at as pickup_at,
  dropoff.location as dropoff_location,
  dropoff.scheduled_at as dropoff_at
from public.loads l
join public.dispatches disp on disp.load_id = l.id
left join public.drivers drv on drv.id = disp.driver_id
left join public.load_stops pickup on pickup.dispatch_id = disp.id and pickup.stop_type = 'pickup'
left join public.load_stops dropoff on dropoff.dispatch_id = disp.id and dropoff.stop_type = 'dropoff';

grant select on public.loads_with_dispatch to authenticated;

-- ============================================================================
-- create_load_with_dispatch() — the one place a load gets created.
-- Booking (loads) + operational (dispatches) + the two initial stops
-- (load_stops) as one call so a load is never left half-created. NOT
-- security definer — runs as the calling user, so the INSERT policies
-- on all three tables (and the past-due write lock trigger) apply
-- exactly as if the client had called them directly. Same philosophy
-- as dashboard_summary()/dashboard_revenue_by_month(): RLS is the real
-- enforcement layer, this function doesn't bypass it.
-- ============================================================================

create function public.create_load_with_dispatch(
  p_company_id      uuid,
  p_customer_id     uuid,
  p_client_name     text,
  p_client_rate     numeric,
  p_notes           text,
  p_driver_id       uuid,
  p_driver_pay      numeric,
  p_pickup_location text,
  p_pickup_at       timestamptz,
  p_dropoff_location text,
  p_dropoff_at      timestamptz
)
returns uuid
language plpgsql
as $$
declare
  new_load_id     uuid;
  new_dispatch_id uuid;
  initial_status  text := case when p_driver_id is null then 'unassigned' else 'assigned' end;
begin
  insert into public.loads (company_id, customer_id, client_name, client_rate, notes)
  values (p_company_id, p_customer_id, p_client_name, coalesce(p_client_rate, 0), p_notes)
  returning id into new_load_id;

  insert into public.dispatches (company_id, load_id, driver_id, status, driver_pay)
  values (p_company_id, new_load_id, p_driver_id, initial_status, coalesce(p_driver_pay, 0))
  returning id into new_dispatch_id;

  insert into public.load_stops (company_id, dispatch_id, stop_type, sequence, location, scheduled_at)
  values
    (p_company_id, new_dispatch_id, 'pickup', 1, p_pickup_location, p_pickup_at),
    (p_company_id, new_dispatch_id, 'dropoff', 2, p_dropoff_location, p_dropoff_at);

  return new_load_id;
end;
$$;

-- ============================================================================
-- dashboard_summary() / dashboard_revenue_by_month() — rebuilt against
-- dispatches for status/driver_pay/delivered_at, loads for client_rate.
-- Same NOT security definer / owner+admin-gated-inside-the-function
-- conventions as 0007/0015.
-- ============================================================================

create or replace function public.dashboard_summary()
returns table (
  total_loads_count        bigint,
  delivered_loads_count    bigint,
  payments_awaiting_count  bigint,
  payments_awaiting_total  numeric,
  revenue_total            numeric,
  driver_pay_total         numeric
)
language sql
stable
as $$
  select
    (select count(*) from public.loads) as total_loads_count,

    (select count(*) from public.dispatches where status = 'delivered') as delivered_loads_count,

    (
      select count(*)
      from public.dispatches d
      where d.status = 'delivered'
        and d.driver_id is not null
        and not exists (select 1 from public.payments p where p.load_id = d.load_id)
    ) as payments_awaiting_count,

    (
      select coalesce(sum(d.driver_pay), 0)
      from public.dispatches d
      where d.status = 'delivered'
        and d.driver_id is not null
        and not exists (select 1 from public.payments p where p.load_id = d.load_id)
    ) as payments_awaiting_total,

    case when public.current_user_role() in ('owner', 'admin')
      then (
        select coalesce(sum(l.client_rate), 0)
        from public.loads l
        join public.dispatches d on d.load_id = l.id
        where d.status = 'delivered'
      )
      else null
    end as revenue_total,

    case when public.current_user_role() in ('owner', 'admin')
      then (select coalesce(sum(driver_pay), 0) from public.dispatches where status = 'delivered')
      else null
    end as driver_pay_total;
$$;

create or replace function public.dashboard_revenue_by_month()
returns table (
  month_start date,
  revenue     numeric,
  driver_pay  numeric
)
language sql
stable
as $$
  select
    date_trunc('month', d.delivered_at)::date as month_start,
    coalesce(sum(l.client_rate), 0) as revenue,
    coalesce(sum(d.driver_pay), 0) as driver_pay
  from public.dispatches d
  join public.loads l on l.id = d.load_id
  where d.status = 'delivered'
    and d.delivered_at >= date_trunc('month', now()) - interval '5 months'
    and public.current_user_role() in ('owner', 'admin')
  group by date_trunc('month', d.delivered_at)
  order by month_start;
$$;
