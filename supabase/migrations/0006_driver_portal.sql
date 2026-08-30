-- Corridor Freight — Phase 4: Driver Portal Foundation
-- Adds a `driver` role with its own login, scoped by RLS to that
-- driver's own assigned loads only. Most of this migration is
-- TIGHTENING existing policies, not just adding new ones — every
-- current loads/drivers/payments/companies-update policy only checks
-- company_id, never role, so a driver profile in a company would
-- otherwise inherit full owner/dispatcher-level visibility the moment
-- it exists. RLS OR's every applicable policy together, so a narrow new
-- policy sitting next to an unchanged broad one does nothing — the
-- broad one still wins.

-- ============================================================================
-- role + driver-account linking
-- ============================================================================

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('owner', 'dispatcher', 'driver'));

-- Nullable until a driver actually claims an invite. The drivers table
-- stays the one source of truth for name/phone/email/status — this is
-- purely the link to their login, not a duplicate identity record.
alter table public.drivers
  add column user_id uuid unique references auth.users (id) on delete set null;

-- ============================================================================
-- invites: extended for driver invites, not a parallel table
-- ----------------------------------------------------------------------------
-- role defaults to 'dispatcher' so the existing owner-invite flow keeps
-- working unmodified. driver_id is only set for driver invites — it's
-- what tells handle_new_user() which existing drivers row to claim,
-- since (unlike a dispatcher invite) a driver invite is always for a
-- record the dispatcher already created, not a blank new identity.
-- ============================================================================

alter table public.invites
  add column role text not null default 'dispatcher' check (role in ('dispatcher', 'driver')),
  add column driver_id uuid references public.drivers (id) on delete cascade;

-- ============================================================================
-- handle_new_user(): now claims a drivers row when the invite is one
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
  end if;

  return new;
end;
$$;

-- ============================================================================
-- tighten existing policies to owner/dispatcher only
-- ----------------------------------------------------------------------------
-- Same USING/WITH CHECK as before, plus a role check. Positive allow-list
-- (role IN (...)) rather than excluding 'driver' specifically, so any
-- future role added here defaults to no access instead of silently
-- inheriting these unless someone remembers to come back and exclude it.
-- ============================================================================

drop policy "owner can update own company" on public.companies;
create policy "owner can update own company"
  on public.companies for update
  using (id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher'))
  with check (id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher'));

drop policy "select own company drivers" on public.drivers;
create policy "select own company drivers"
  on public.drivers for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher'));

drop policy "insert own company drivers" on public.drivers;
create policy "insert own company drivers"
  on public.drivers for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher'));

drop policy "update own company drivers" on public.drivers;
create policy "update own company drivers"
  on public.drivers for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher'));

drop policy "select own company loads" on public.loads;
create policy "select own company loads"
  on public.loads for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher'));

drop policy "insert own company loads" on public.loads;
create policy "insert own company loads"
  on public.loads for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher'));

drop policy "update own company loads" on public.loads;
create policy "update own company loads"
  on public.loads for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher'));

drop policy "select own company payments" on public.payments;
create policy "select own company payments"
  on public.payments for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher'));

drop policy "insert own company payments" on public.payments;
create policy "insert own company payments"
  on public.payments for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher'));

drop policy "update own company payments" on public.payments;
create policy "update own company payments"
  on public.payments for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher'));

-- ============================================================================
-- new, narrow driver-scoped policies
-- ============================================================================

-- A driver's own drivers row — needed for their own profile page. Not
-- the rest of the roster (that's the point of the tightened policy
-- above).
create policy "drivers can view own driver record"
  on public.drivers for select
  using (user_id = auth.uid());

create policy "drivers can update own driver record"
  on public.drivers for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ----------------------------------------------------------------------------
-- Column-level restriction for driver self-updates
-- ----------------------------------------------------------------------------
-- RLS has no column-level granularity — the policy above only restricts
-- WHICH ROW a driver can touch (their own), not WHICH COLUMNS. Relying on
-- the client form to simply not send status/company_id/user_id isn't a
-- real boundary (any direct REST/JS call bypasses the UI), so this
-- trigger enforces it in the database instead: when the acting user is a
-- driver, silently pin status/company_id/user_id back to their prior
-- values no matter what the update statement sent, leaving only
-- full_name/phone actually settable by the driver.
create or replace function public.lock_driver_self_service_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() = 'driver' then
    new.status := old.status;
    new.company_id := old.company_id;
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;

create trigger lock_driver_self_service_columns
  before update on public.drivers
  for each row
  execute function public.lock_driver_self_service_columns();

-- The d.company_id = loads.company_id check isn't redundant — nothing
-- before this migration actually enforced that a load's driver_id
-- points at a driver in the *same* company as the load, so this closes
-- that latent gap explicitly rather than assuming it can't happen.
-- d.status = 'active' matters as much as d.user_id here — without it, a
-- driver who's been archived (fired) keeps read access to whatever was
-- assigned to them at the time, indefinitely.
create policy "drivers can view their own assigned loads"
  on public.loads for select
  using (
    exists (
      select 1 from public.drivers d
      where d.user_id = auth.uid()
        and d.id = loads.driver_id
        and d.company_id = loads.company_id
        and d.status = 'active'
    )
  );

-- Deliberately narrower than "can update their own load": USING blocks
-- touching a load that's already terminal at all, and WITH CHECK means
-- even a buggy or compromised client can only ever land the row on
-- in_transit or delivered — never cancelled, never back to unassigned,
-- never reassigned to someone else.
create policy "drivers can advance their own assigned loads"
  on public.loads for update
  using (
    status not in ('delivered', 'cancelled')
    and exists (
      select 1 from public.drivers d
      where d.user_id = auth.uid()
        and d.id = loads.driver_id
        and d.company_id = loads.company_id
        and d.status = 'active'
    )
  )
  with check (
    status in ('in_transit', 'delivered')
    and exists (
      select 1 from public.drivers d
      where d.user_id = auth.uid()
        and d.id = loads.driver_id
        and d.company_id = loads.company_id
        and d.status = 'active'
    )
  );
