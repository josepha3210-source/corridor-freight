-- Corridor Freight — Phase 3a/3b: Trucks & Equipment, Customers & Address Book
-- Two new tables, both following the exact company-scoped RLS pattern
-- drivers already uses (0001, tightened in 0006/0007): owner/dispatcher/
-- admin can select/insert/update, no delete policy at all — archive via
-- `status`, same "no hard delete" reasoning as 0003. Neither table is
-- linked to billing or driver-limit enforcement; both are plain
-- operational records.
--
-- Deliberately one `contacts` table with a `type` column, not separate
-- tables per contact type — customers, vendors, brokers, factoring
-- companies, and carriers all need essentially the same fields (name,
-- contact info, address, notes); `payment_terms` is the one genuinely
-- customer-specific field, left nullable for every other type rather
-- than justifying a second table for one column.
--
-- Does NOT yet touch how the app displays a load's customer — this
-- migration adds `loads.customer_id` and backfills it from the existing
-- free-text `client_name`, but `client_name` itself is untouched and
-- stays the column every existing read site still uses. The app-level
-- switch to a customer picker (still writing client_name too, kept in
-- sync at creation time so nothing downstream needs to change yet) is
-- built in this same phase but is a separate, smaller, and separately
-- verifiable step from this schema change.

-- ============================================================================
-- trucks
-- ============================================================================

create table public.trucks (
  id                      uuid primary key default gen_random_uuid(),
  company_id              uuid not null references public.companies (id) on delete cascade,
  vin                     text,
  plate_number            text,
  plate_state             text,
  make                    text,
  model                   text,
  year                    integer,
  status                  text not null default 'active' check (status in ('active', 'maintenance', 'inactive')),
  registration_expires_at date,
  insurance_expires_at    date,
  next_inspection_due_at  date,
  assigned_driver_id      uuid references public.drivers (id) on delete set null,
  odometer                integer,
  created_at              timestamptz not null default now()
);

create index trucks_company_id_idx on public.trucks (company_id);

alter table public.trucks enable row level security;

create policy "select own company trucks"
  on public.trucks for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "insert own company trucks"
  on public.trucks for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "update own company trucks"
  on public.trucks for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

-- ============================================================================
-- contacts (customers, vendors, brokers, factoring companies, carriers)
-- ============================================================================

create table public.contacts (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references public.companies (id) on delete cascade,
  type            text not null check (type in ('customer', 'vendor', 'broker', 'factoring', 'carrier')),
  name            text not null,
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  billing_address text,
  -- Customer-specific; left null for every other type rather than a
  -- second table just for this one column.
  payment_terms   text check (payment_terms is null or payment_terms in ('net_15', 'net_30', 'net_45', 'net_60')),
  notes           text,
  status          text not null default 'active' check (status in ('active', 'inactive')),
  created_at      timestamptz not null default now()
);

create index contacts_company_id_idx on public.contacts (company_id);

alter table public.contacts enable row level security;

create policy "select own company contacts"
  on public.contacts for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "insert own company contacts"
  on public.contacts for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "update own company contacts"
  on public.contacts for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

-- ============================================================================
-- loads.customer_id — added and backfilled, client_name untouched
-- ----------------------------------------------------------------------------
-- One contact per distinct (company_id, client_name) pair already on
-- record — exact string match only, per the spec's own instruction not
-- to attempt fuzzy-matching typos/duplicates in a migration. Whoever
-- owns the data merges obvious duplicates afterward via the Customers
-- page, not something this migration guesses at.
-- ============================================================================

alter table public.loads add column customer_id uuid references public.contacts (id);

insert into public.contacts (company_id, type, name)
select distinct company_id, 'customer', client_name
from public.loads
where client_name is not null and trim(client_name) <> '';

update public.loads l
set customer_id = c.id
from public.contacts c
where c.company_id = l.company_id
  and c.type = 'customer'
  and c.name = l.client_name
  and l.customer_id is null;
