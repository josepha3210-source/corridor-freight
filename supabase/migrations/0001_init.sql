-- Corridor Freight — Phase 1 schema
-- Companies, profiles (the link between an auth user and a company),
-- drivers, loads, payments, plus the trigger and RLS policies that make
-- this safe for multiple tenants to share one database.

-- ============================================================================
-- extensions
-- ============================================================================
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- ============================================================================
-- tables
-- ============================================================================

create table public.companies (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- One row per Supabase auth user. This is the piece that isn't in the
-- product spec's table list but has to exist: it's how we know which
-- company a logged-in user belongs to, since auth.users is managed by
-- Supabase and we can't add a company_id column to it directly.
create table public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  full_name  text,
  role       text not null default 'owner' check (role in ('owner', 'dispatcher')),
  created_at timestamptz not null default now()
);

create table public.drivers (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  full_name  text not null,
  phone      text,
  email      text,
  status     text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table public.loads (
  id                uuid primary key default gen_random_uuid(),
  company_id        uuid not null references public.companies (id) on delete cascade,
  driver_id         uuid references public.drivers (id) on delete set null,

  client_name       text not null,
  pickup_location   text not null,
  pickup_at         timestamptz,
  dropoff_location  text not null,
  dropoff_at        timestamptz,

  status            text not null default 'unassigned'
                       check (status in ('unassigned', 'assigned', 'in_transit', 'delivered', 'cancelled')),

  -- pay breakdown: what the client is charged, what the driver earns.
  -- margin is derived (charge - driver_pay), never stored, so it can
  -- never drift out of sync with the two numbers it's built from.
  client_rate       numeric(10, 2) not null default 0 check (client_rate >= 0),
  driver_pay        numeric(10, 2) not null default 0 check (driver_pay >= 0),

  -- e-signature capture at delivery
  signed_by_name    text,
  signature_data    text, -- data URL (PNG) from the signature pad
  delivered_at      timestamptz,

  notes             text,
  created_at        timestamptz not null default now()
);

create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  load_id    uuid not null references public.loads (id) on delete cascade,
  driver_id  uuid not null references public.drivers (id) on delete cascade,

  amount     numeric(10, 2) not null check (amount >= 0),
  status     text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- indexes (every tenant-scoped table is filtered by company_id constantly)
-- ============================================================================

create index profiles_company_id_idx on public.profiles (company_id);
create index drivers_company_id_idx  on public.drivers (company_id);
create index loads_company_id_idx    on public.loads (company_id);
create index loads_driver_id_idx     on public.loads (driver_id);
create index payments_company_id_idx on public.payments (company_id);
create index payments_load_id_idx    on public.payments (load_id);
create index payments_driver_id_idx  on public.payments (driver_id);

-- ============================================================================
-- helper: current_company_id()
-- ----------------------------------------------------------------------------
-- Every RLS policy below needs to answer "what company does the logged-in
-- user belong to?". Rather than repeat a subquery on profiles in every
-- policy, wrap it once. SECURITY DEFINER + a pinned search_path lets this
-- function read profiles on the caller's behalf even though profiles has
-- its own RLS enabled — otherwise the policy on profiles would need to
-- query profiles to know if it can query profiles, which is a deadlock.
-- STABLE lets Postgres cache the result for the duration of one query.
-- ============================================================================

create function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid();
$$;

-- ============================================================================
-- trigger: create a company + owner profile on sign-up
-- ----------------------------------------------------------------------------
-- The sign-up form (app/signup) passes company_name and full_name in the
-- new user's metadata. This trigger fires after Supabase auth inserts the
-- row into auth.users, and does the two writes atomically as one server-
-- side unit so a signed-up user can never end up without a company.
-- SECURITY DEFINER is required because the client's own session has no
-- INSERT policy on companies (see below) — only this trigger can create one.
-- ============================================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_company_id uuid;
begin
  insert into public.companies (name)
  values (coalesce(new.raw_user_meta_data ->> 'company_name', 'My Company'))
  returning id into new_company_id;

  insert into public.profiles (id, company_id, full_name, role)
  values (
    new.id,
    new_company_id,
    new.raw_user_meta_data ->> 'full_name',
    'owner'
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- row-level security
-- ============================================================================

alter table public.companies enable row level security;
alter table public.profiles  enable row level security;
alter table public.drivers   enable row level security;
alter table public.loads     enable row level security;
alter table public.payments  enable row level security;

-- companies: read-only from the client's perspective. Rows are created by
-- the trigger above (as the definer, bypassing RLS) — there is no INSERT
-- policy here on purpose, so a logged-in user can never create a second
-- company for themselves through the API.
create policy "select own company"
  on public.companies for select
  using (id = public.current_company_id());

create policy "owner can update own company"
  on public.companies for update
  using (id = public.current_company_id())
  with check (id = public.current_company_id());

-- profiles: see your own row and your teammates' (same company). You may
-- only ever edit your own row, and never move yourself to another company.
create policy "select profiles in own company"
  on public.profiles for select
  using (company_id = public.current_company_id());

create policy "update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and company_id = public.current_company_id());

-- drivers / loads / payments: standard tenant-scoped CRUD. Every row must
-- belong to the caller's company on the way in (with check) and on the
-- way out (using) — that pair is what stops both cross-tenant reads and
-- a client trying to insert or re-point a row into another company_id.
create policy "select own company drivers"
  on public.drivers for select
  using (company_id = public.current_company_id());
create policy "insert own company drivers"
  on public.drivers for insert
  with check (company_id = public.current_company_id());
create policy "update own company drivers"
  on public.drivers for update
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "delete own company drivers"
  on public.drivers for delete
  using (company_id = public.current_company_id());

create policy "select own company loads"
  on public.loads for select
  using (company_id = public.current_company_id());
create policy "insert own company loads"
  on public.loads for insert
  with check (company_id = public.current_company_id());
create policy "update own company loads"
  on public.loads for update
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "delete own company loads"
  on public.loads for delete
  using (company_id = public.current_company_id());

create policy "select own company payments"
  on public.payments for select
  using (company_id = public.current_company_id());
create policy "insert own company payments"
  on public.payments for insert
  with check (company_id = public.current_company_id());
create policy "update own company payments"
  on public.payments for update
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());
create policy "delete own company payments"
  on public.payments for delete
  using (company_id = public.current_company_id());
