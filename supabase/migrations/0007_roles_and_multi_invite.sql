-- Corridor Freight — Phase 5: Roles & Multi-Invite
-- Adds an `admin` role — the same day-to-day operational access as
-- dispatcher, plus owner-level visibility into revenue and Team, minus
-- anything billing/account-danger-zone (nothing billing-related exists
-- yet; this is here so admin doesn't quietly become indistinguishable
-- from owner once Phase 6 adds real billing controls that must stay
-- owner-only). See ROADMAP.md §66 for the full role model this
-- implements.

-- ============================================================================
-- role
-- ============================================================================

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('owner', 'dispatcher', 'driver', 'admin'));

-- ============================================================================
-- dashboard_summary(): revenue is owner+admin, not owner-only
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
    (select count(*) from public.loads where status = 'delivered') as delivered_loads_count,
    (
      select count(*)
      from public.loads l
      where l.status = 'delivered'
        and l.driver_id is not null
        and not exists (select 1 from public.payments p where p.load_id = l.id)
    ) as payments_awaiting_count,
    (
      select coalesce(sum(l.driver_pay), 0)
      from public.loads l
      where l.status = 'delivered'
        and l.driver_id is not null
        and not exists (select 1 from public.payments p where p.load_id = l.id)
    ) as payments_awaiting_total,
    case when public.current_user_role() in ('owner', 'admin')
      then (select coalesce(sum(client_rate), 0) from public.loads where status = 'delivered')
      else null
    end as revenue_total,
    case when public.current_user_role() in ('owner', 'admin')
      then (select coalesce(sum(driver_pay), 0) from public.loads where status = 'delivered')
      else null
    end as driver_pay_total;
$$;

-- ============================================================================
-- operational tables: admin joins owner+dispatcher — ordinary day-to-day
-- access, not a new tier. (loads/drivers/payments only; company
-- settings below is deliberately handled differently.)
-- ============================================================================

drop policy "select own company drivers" on public.drivers;
create policy "select own company drivers"
  on public.drivers for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

drop policy "insert own company drivers" on public.drivers;
create policy "insert own company drivers"
  on public.drivers for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

drop policy "update own company drivers" on public.drivers;
create policy "update own company drivers"
  on public.drivers for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

drop policy "select own company loads" on public.loads;
create policy "select own company loads"
  on public.loads for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

drop policy "insert own company loads" on public.loads;
create policy "insert own company loads"
  on public.loads for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

drop policy "update own company loads" on public.loads;
create policy "update own company loads"
  on public.loads for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

drop policy "select own company payments" on public.payments;
create policy "select own company payments"
  on public.payments for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

drop policy "insert own company payments" on public.payments;
create policy "insert own company payments"
  on public.payments for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

drop policy "update own company payments" on public.payments;
create policy "update own company payments"
  on public.payments for update
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

-- ============================================================================
-- company settings: owner+admin only — deliberately NOT the operational
-- tier above. A dispatcher managing loads day-to-day has no reason to
-- change the company's name/phone/address; that's account
-- administration, not operations. (This tightens what 0006 allowed,
-- which included dispatcher only because it was preserving the
-- pre-Phase-4 "any member can update" behavior without re-examining
-- whether that was ever the right boundary — it wasn't.)
-- ============================================================================

drop policy "owner can update own company" on public.companies;
create policy "owner and admin can update own company"
  on public.companies for update
  using (id = public.current_company_id() and public.current_user_role() in ('owner', 'admin'))
  with check (id = public.current_company_id() and public.current_user_role() in ('owner', 'admin'));

-- ============================================================================
-- invites: role-conditional, not a flat allow-list — WHAT role is being
-- invited determines who's allowed to send it, not just who's sending.
-- A dispatcher inviting a driver is ordinary day-to-day driver
-- management (same tier as creating a drivers row themselves); a
-- dispatcher inviting a fellow dispatcher or an admin would be
-- self-service team composition, which stays owner+admin only.
-- ============================================================================

-- Owner/admin see every invite in the company (Team section needs the
-- full list). A dispatcher sees only invites they personally sent —
-- narrower than "the whole team's invites," but still enough: the
-- driver-invite route does insert().select().single() in one round
-- trip, so a dispatcher (who's allowed to insert a driver invite) has
-- to also be able to read back the row they just created, or that
-- route breaks for them specifically. invited_by = auth.uid() covers
-- exactly that case without granting visibility into invites sent by
-- someone else.
drop policy "owners can view own company invites" on public.invites;
create policy "owner/admin view all, others view invites they sent"
  on public.invites for select
  using (
    company_id = public.current_company_id()
    and (
      public.current_user_role() in ('owner', 'admin')
      or invited_by = auth.uid()
    )
  );

drop policy "owners can create invites for own company" on public.invites;
create policy "authorized roles can create invites"
  on public.invites for insert
  with check (
    company_id = public.current_company_id()
    and (
      (role = 'driver' and public.current_user_role() in ('owner', 'dispatcher', 'admin'))
      or (role in ('dispatcher', 'admin') and public.current_user_role() in ('owner', 'admin'))
    )
  );

drop policy "owners can delete own company invites" on public.invites;
create policy "owner and admin can delete own company invites"
  on public.invites for delete
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'admin'));
