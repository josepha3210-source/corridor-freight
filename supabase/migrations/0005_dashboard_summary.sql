-- Corridor Freight — Dashboard home screen
-- One function covering every aggregate number the dashboard needs, so
-- counts/sums happen in SQL instead of fetching full tables in to sum
-- client-side. Deliberately NOT security definer — it runs as the
-- caller, so every subquery below is scoped by RLS exactly as if the
-- app had run it directly. No new grant needed, matching how
-- current_company_id() / current_user_role() already work.

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

    -- Kept separate from revenue_total being merely zero — a delivered
    -- load can legitimately have a $0 rate, and that shouldn't look
    -- identical to "no delivered loads yet" in the empty state.
    (select count(*) from public.loads where status = 'delivered') as delivered_loads_count,

    -- "Awaiting payment" mirrors the Payroll page's own definition
    -- exactly (delivered, has a driver, no payment row yet) — computed
    -- once here so the two pages can never quietly disagree.
    (
      select count(*)
      from public.loads l
      where l.status = 'delivered'
        and l.driver_id is not null
        and not exists (
          select 1 from public.payments p where p.load_id = l.id
        )
    ) as payments_awaiting_count,

    (
      select coalesce(sum(l.driver_pay), 0)
      from public.loads l
      where l.status = 'delivered'
        and l.driver_id is not null
        and not exists (
          select 1 from public.payments p where p.load_id = l.id
        )
    ) as payments_awaiting_total,

    -- Revenue/margin is owner-only data — checked here too, not just by
    -- the page choosing not to render it, same two-layer pattern as the
    -- Settings Team section (RLS-level check + app-level check).
    case when public.current_user_role() = 'owner'
      then (select coalesce(sum(client_rate), 0) from public.loads where status = 'delivered')
      else null
    end as revenue_total,

    case when public.current_user_role() = 'owner'
      then (select coalesce(sum(driver_pay), 0) from public.loads where status = 'delivered')
      else null
    end as driver_pay_total;
$$;
