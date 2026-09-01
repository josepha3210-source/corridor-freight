-- Corridor Freight — Phase 4c: Fuel tracking
-- Captures per-purchase fuel data with a jurisdiction on every row —
-- the raw material IFTA quarterly reporting (Phase 5a, not built yet)
-- will aggregate by jurisdiction and quarter. This migration only
-- covers capturing the purchases; the report itself is a separate,
-- later phase.
--
-- Jurisdiction is constrained to the real IFTA jurisdiction list — the
-- 48 contiguous US states plus DC and the 10 Canadian provinces IFTA
-- covers (not Alaska/Hawaii, not the Canadian territories — neither
-- participates in IFTA). Getting this list right now matters because
-- Phase 5a's report is only as correct as what it's built on top of.

create table public.fuel_purchases (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null references public.companies (id) on delete cascade,
  truck_id       uuid references public.trucks (id) on delete set null,
  driver_id      uuid references public.drivers (id) on delete set null,

  purchase_date  date not null default current_date,
  jurisdiction   text not null check (jurisdiction in (
    -- contiguous US + DC
    'AL','AZ','AR','CA','CO','CT','DE','DC','FL','GA','ID','IL','IN','IA',
    'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH',
    'NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX',
    'UT','VT','VA','WA','WV','WI','WY',
    -- Canadian provinces IFTA covers (not the territories)
    'AB','BC','MB','NB','NL','NS','ON','PE','QC','SK'
  )),

  gallons        numeric(10, 3) not null check (gallons > 0),
  total_amount   numeric(10, 2) not null check (total_amount >= 0),
  odometer       integer,
  notes          text,

  created_at     timestamptz not null default now()
);

create index fuel_purchases_company_id_idx    on public.fuel_purchases (company_id);
create index fuel_purchases_truck_id_idx      on public.fuel_purchases (truck_id);
create index fuel_purchases_driver_id_idx     on public.fuel_purchases (driver_id);
create index fuel_purchases_purchase_date_idx on public.fuel_purchases (purchase_date);

alter table public.fuel_purchases enable row level security;

create policy "select own company fuel purchases"
  on public.fuel_purchases for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "insert own company fuel purchases"
  on public.fuel_purchases for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "update own company fuel purchases"
  on public.fuel_purchases for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));
