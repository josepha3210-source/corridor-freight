-- Corridor Freight — Phase 6: Billing Foundation
-- Infrastructure only — no real Stripe account exists yet (see
-- ROADMAP.md §70). Real, editable plan rows (not hardcoded Stripe price
-- IDs), a subscription-status column on companies, and a driver-count
-- limit enforced in the database, not just hidden in the UI. Stripe
-- linkage columns (stripe_price_id / stripe_customer_id /
-- stripe_subscription_id) are here and nullable so the app code that
-- reads/writes them can be written and tested now, before any of them
-- have real values.

-- ============================================================================
-- plans — a shared catalog, not tenant-scoped. Joseph edits these rows
-- directly (Supabase dashboard/SQL) once real pricing is decided; the
-- app never writes to this table.
-- ============================================================================

create table public.plans (
  id                   uuid primary key default gen_random_uuid(),
  key                  text not null unique, -- stable machine id, e.g. 'trial' — never shown to users
  name                 text not null,        -- display name, e.g. 'Trial'
  driver_limit         integer not null check (driver_limit > 0),
  monthly_price_cents  integer check (monthly_price_cents is null or monthly_price_cents >= 0),
  stripe_price_id      text,                 -- null until a real Stripe Price exists for this plan
  sort_order           integer not null default 0,
  created_at           timestamptz not null default now()
);

alter table public.plans enable row level security;

-- Read-only catalog for any signed-in user (the Billing section needs to
-- list plans to upgrade to). No insert/update/delete policy — these rows
-- are managed outside the app entirely, same reasoning as "companies"
-- having no client insert policy.
create policy "authenticated users can view plans"
  on public.plans for select
  to authenticated
  using (true);

-- Placeholder tiers — names and driver_limit numbers here are exactly
-- that, placeholders, so the schema and UI have something real to work
-- against before actual pricing is decided. monthly_price_cents is left
-- null (undecided) except the trial, which is genuinely free.
insert into public.plans (key, name, driver_limit, monthly_price_cents, sort_order) values
  ('trial',   'Trial',   3,   0,    0),
  ('starter', 'Starter', 10,  null, 1),
  ('growth',  'Growth',  25,  null, 2),
  ('fleet',   'Fleet',   100, null, 3);

-- ============================================================================
-- companies: subscription state
-- ============================================================================

alter table public.companies
  add column subscription_status text not null default 'trialing'
    check (subscription_status in ('trialing', 'active', 'past_due', 'canceled')),
  add column plan_id uuid references public.plans (id),
  add column stripe_customer_id text,
  add column stripe_subscription_id text;

-- Backfill every existing company onto the trial plan explicitly.
update public.companies
  set plan_id = (select id from public.plans where key = 'trial')
  where plan_id is null;

alter table public.companies
  alter column plan_id set not null;

-- ----------------------------------------------------------------------------
-- handle_new_user(): now also assigns the trial plan
-- ----------------------------------------------------------------------------
-- Postgres doesn't allow a subquery in a column DEFAULT, so a brand-new
-- company can't just fall onto the trial plan automatically the way
-- subscription_status does with its constant default — this has to be an
-- explicit value in the INSERT itself. Same function 0004/0006 already
-- own and have each extended in turn; identical to the 0006 version
-- otherwise, only the company-creation branch's INSERT changed.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched_invite public.invites;
  new_company_id uuid;
begin
  select * into matched_invite
    from public.invites
    where lower(email) = lower(new.email) and accepted_at is null
    order by created_at desc
    limit 1;

  if matched_invite.id is not null then
    insert into public.profiles (id, company_id, full_name, role)
    values (
      new.id,
      matched_invite.company_id,
      new.raw_user_meta_data ->> 'full_name',
      matched_invite.role
    );

    if matched_invite.role = 'driver' and matched_invite.driver_id is not null then
      update public.drivers set user_id = new.id where id = matched_invite.driver_id;
    end if;

    update public.invites set accepted_at = now() where id = matched_invite.id;
  else
    insert into public.companies (name, plan_id)
    values (
      coalesce(new.raw_user_meta_data ->> 'company_name', 'My Company'),
      (select id from public.plans where key = 'trial')
    )
    returning id into new_company_id;

    insert into public.profiles (id, company_id, full_name, role)
    values (
      new.id,
      new_company_id,
      new.raw_user_meta_data ->> 'full_name',
      'owner'
    );
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Column-level lock: billing state can only move through the service
-- role (webhooks, and the checkout route's own narrow customer-id write),
-- never through a normal end-user request — same reasoning and same
-- pattern as 0006's lock_driver_self_service_columns. Without this, the
-- existing "owner and admin can update own company" policy (0007) would
-- let an owner (or admin, before this migration existed to separate
-- them) grant themselves an active subscription and a higher driver
-- limit by just PATCHing their own company row — RLS has no column
-- granularity, so the policy alone can't stop that.
-- ============================================================================

create or replace function public.lock_company_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- auth.uid() is null for a service-role request (webhooks, and the
  -- checkout route's admin-client write) — there's no user session to
  -- have an id in the first place. Any request that DOES have one, even
  -- the company's own owner, gets these columns pinned back no matter
  -- what the UPDATE statement asked for.
  if auth.uid() is not null then
    new.subscription_status := old.subscription_status;
    new.plan_id := old.plan_id;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
  end if;
  return new;
end;
$$;

create trigger lock_company_billing_columns
  before update on public.companies
  for each row
  execute function public.lock_company_billing_columns();

-- ============================================================================
-- driver-count limit, enforced in the database
-- ----------------------------------------------------------------------------
-- Deliberately a trigger with RAISE EXCEPTION rather than folding this
-- into the drivers INSERT policy: an RLS violation surfaces to the
-- client as an opaque "new row violates row-level security policy" with
-- no room for a specific message, which fails point 2's "show a clear
-- message, don't just let it silently fail" requirement. A trigger can
-- raise exactly the message the UI needs to show, and it also covers
-- reactivating an existing inactive driver back to active (the other way
-- a company's active-driver count can grow), not just brand-new inserts.
-- ============================================================================

create or replace function public.enforce_driver_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  active_count integer;
  seat_limit   integer;
  plan_name    text;
begin
  -- Only insert, or an update that *changes* status to 'active', can
  -- grow the active count. Anything else (editing name/phone, staying
  -- active, staying inactive, deactivating) never needs checking.
  if new.status <> 'active' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'active' then
    return new;
  end if;

  select p.driver_limit, p.name into seat_limit, plan_name
    from public.companies c
    join public.plans p on p.id = c.plan_id
    where c.id = new.company_id;

  -- No plan/limit resolvable (shouldn't happen post-migration, but this
  -- is a hard database gate — fail open rather than blocking every
  -- driver add company-wide if something's misconfigured).
  if seat_limit is null then
    return new;
  end if;

  select count(*) into active_count
    from public.drivers
    where company_id = new.company_id
      and status = 'active'
      and id <> new.id;

  if active_count >= seat_limit then
    raise exception
      using
        message = format(
          'Your %s plan allows up to %s active drivers. Deactivate a driver or upgrade your plan to add more.',
          plan_name, seat_limit
        ),
        errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger enforce_driver_limit
  before insert or update on public.drivers
  for each row
  execute function public.enforce_driver_limit();
