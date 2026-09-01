-- Corridor Freight — non-payment / past-due grace period
-- Today a past_due subscription just shows a cosmetic status badge and
-- otherwise changes nothing — a carrier could go months without paying
-- and never notice. This adds: a timestamp for when past_due actually
-- started (so a banner/grace-period can be computed at all), and a real
-- database-enforced write lock once the grace period runs out — not
-- just hiding a button, same "the UI gate isn't the real gate"
-- reasoning as every other limit in this app (see 0009's
-- enforce_driver_limit).
--
-- Deliberately does NOT touch UPDATE — only blocks INSERT on drivers and
-- loads. Marking an existing load delivered, editing an existing
-- driver, viewing anything — all keep working during lockout. A carrier
-- mid-delivery shouldn't lose the ability to close out a load because a
-- card expired.

alter table public.companies
  add column past_due_since timestamptz;

-- Extends 0009's lock — same reasoning, one more column that should
-- only ever move through the service role (the webhook), never a normal
-- end-user request even the owner's own. The trigger that calls this
-- function already exists from 0009; CREATE OR REPLACE is enough here,
-- no need to touch the trigger itself.
create or replace function public.lock_company_billing_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.subscription_status := old.subscription_status;
    new.plan_id := old.plan_id;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.past_due_since := old.past_due_since;
  end if;
  return new;
end;
$$;

-- ============================================================================
-- is_write_locked(): true once a company has been past_due longer than
-- the grace period
-- ----------------------------------------------------------------------------
-- The "7" here has to stay in sync with PAST_DUE_GRACE_PERIOD_DAYS in
-- lib/past-due.ts by hand — SQL and the app don't share one source of
-- truth for this number. Update both together if it ever changes.
-- ============================================================================

create or replace function public.is_write_locked(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select subscription_status = 'past_due'
        and past_due_since is not null
        and now() > past_due_since + interval '7 days'
      from public.companies
      where id = p_company_id
    ),
    false
  );
$$;

create or replace function public.enforce_payment_write_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_write_locked(new.company_id) then
    raise exception
      using
        message = format(
          'Your account is past due and the grace period has ended. Update your payment method in Settings → Billing to add new %s — you can still view and update your existing records.',
          tg_table_name
        ),
        errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger enforce_payment_write_lock_drivers
  before insert on public.drivers
  for each row
  execute function public.enforce_payment_write_lock();

create trigger enforce_payment_write_lock_loads
  before insert on public.loads
  for each row
  execute function public.enforce_payment_write_lock();
