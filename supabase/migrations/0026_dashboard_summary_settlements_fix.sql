-- Corridor Freight — fix: dashboard_summary()'s "payments awaiting"
-- never knew about Settlements
-- ----------------------------------------------------------------------------
-- Caught live (ROADMAP §90/§91): built a real settlement for a driver's
-- delivered load through the Phase 4b UI, and the dashboard's "Payments
-- awaiting" count/total still showed it as outstanding — dashboard_summary()
-- (0017) only ever excluded loads with an old-style `payments` row,
-- because Settlements (0019) didn't exist yet when that function was
-- last written. Same "a delivered load is claimed by payments OR
-- settlements, never neither query knowing about the other" gap the
-- Payroll page itself already guards against (§83) — dashboard_summary()
-- just never got the same fix. Excludes loads with a non-void
-- settlement_line_item now too, on both the count and the total.

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
        and not exists (
          select 1
          from public.settlement_line_items sli
          join public.settlements s on s.id = sli.settlement_id
          where sli.load_id = d.load_id and s.status <> 'void'
        )
    ) as payments_awaiting_count,

    (
      select coalesce(sum(d.driver_pay), 0)
      from public.dispatches d
      where d.status = 'delivered'
        and d.driver_id is not null
        and not exists (select 1 from public.payments p where p.load_id = d.load_id)
        and not exists (
          select 1
          from public.settlement_line_items sli
          join public.settlements s on s.id = sli.settlement_id
          where sli.load_id = d.load_id and s.status <> 'void'
        )
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
