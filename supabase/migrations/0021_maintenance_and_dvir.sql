-- Corridor Freight — Phase 5b: Maintenance & DVIR
-- Two tables: scheduled/completed maintenance per truck, and driver
-- pre/post-trip vehicle inspection reports (DVIR — 49 CFR 396.11
-- requires one of these per driver per duty day). Neither is gated by
-- the past-due write lock (0014/0017's enforce_payment_write_lock) —
-- same reasoning as 0020's fuel_purchases: recording that a service or
-- inspection already happened is bookkeeping/compliance, not new
-- billable work the way a load or dispatch is.

-- ============================================================================
-- maintenance_records
-- ============================================================================

create table public.maintenance_records (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  truck_id      uuid not null references public.trucks (id) on delete cascade,

  service_type  text not null,
  service_date  date not null default current_date,
  odometer      integer,
  cost          numeric(10, 2) check (cost is null or cost >= 0),
  next_due_at   date,
  notes         text,

  created_at    timestamptz not null default now()
);

create index maintenance_records_company_id_idx on public.maintenance_records (company_id);
create index maintenance_records_truck_id_idx   on public.maintenance_records (truck_id);

alter table public.maintenance_records enable row level security;

create policy "select own company maintenance records"
  on public.maintenance_records for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "insert own company maintenance records"
  on public.maintenance_records for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "update own company maintenance records"
  on public.maintenance_records for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

-- ============================================================================
-- dvir_reports — a signed, point-in-time record, same as a load's
-- delivery signature: no update/delete policy at all, not even an
-- archive-via-status one. `checklist` is a fixed FMCSA-standard list of
-- {item, defect} pairs (see lib/dvir-checklist.ts) — plain jsonb rather
-- than a child table, since unlike invoice/settlement line items this
-- list's shape never varies per row, there's nothing relational to gain.
-- ============================================================================

create table public.dvir_reports (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  truck_id          uuid not null references public.trucks (id) on delete cascade,
  driver_id         uuid not null references public.drivers (id),

  inspection_type   text not null check (inspection_type in ('pre_trip', 'post_trip')),
  inspection_date   timestamptz not null default now(),

  checklist         jsonb not null default '[]'::jsonb,
  defects_found     boolean not null default false,
  defect_notes      text,
  satisfactory      boolean not null default true,

  signed_by_name    text not null,
  signature_data    text not null,

  created_at        timestamptz not null default now()
);

create index dvir_reports_company_id_idx on public.dvir_reports (company_id);
create index dvir_reports_truck_id_idx   on public.dvir_reports (truck_id);
create index dvir_reports_driver_id_idx  on public.dvir_reports (driver_id);

alter table public.dvir_reports enable row level security;

-- Staff: full visibility (reviewing inspection reports is the point),
-- can also file one on a driver's behalf if needed.
create policy "select own company dvir reports"
  on public.dvir_reports for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "insert own company dvir reports as staff"
  on public.dvir_reports for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

-- Drivers: can file and view their own — same active-driver-in-same-
-- company shape as every other driver-scoped policy (0006/0017/0019).
create policy "drivers can view their own dvir reports"
  on public.dvir_reports for select
  using (
    exists (
      select 1 from public.drivers d
      where d.id = dvir_reports.driver_id
        and d.user_id = auth.uid()
        and d.status = 'active'
    )
  );

create policy "drivers can file their own dvir reports"
  on public.dvir_reports for insert
  with check (
    exists (
      select 1 from public.drivers d
      where d.id = dvir_reports.driver_id
        and d.user_id = auth.uid()
        and d.company_id = dvir_reports.company_id
        and d.status = 'active'
    )
  );

-- ============================================================================
-- trucks — 0016 only granted select to owner/dispatcher/admin, since
-- Trucks & Equipment was staff-only at the time. Filing a DVIR means a
-- driver has to be able to pick which truck they're inspecting, so this
-- adds (not replaces) a driver-scoped select: active trucks in their
-- own company, same shape as every other driver-visibility policy.
-- ============================================================================

create policy "drivers can view active trucks in their company"
  on public.trucks for select
  using (
    status = 'active'
    and exists (
      select 1 from public.drivers d
      where d.user_id = auth.uid()
        and d.company_id = trucks.company_id
        and d.status = 'active'
    )
  );
