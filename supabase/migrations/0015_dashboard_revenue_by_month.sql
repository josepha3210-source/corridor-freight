-- Corridor Freight — Phase 1: dashboard revenue-by-month
-- One more small aggregate function alongside dashboard_summary() (0005,
-- widened to owner+admin in 0007) — the new "Revenue vs driver pay,
-- last 6 months" chart needs monthly buckets, which a single-row
-- aggregate can't give it. Same conventions as dashboard_summary():
-- NOT security definer (runs as the caller, so the existing "select own
-- company loads" RLS policy scopes every row exactly as if the app
-- queried loads directly — no new grant needed), and the owner/admin
-- gate lives in the query itself, not just in whether the app chooses
-- to call this — same defense-in-depth reasoning as revenue_total there.

create or replace function public.dashboard_revenue_by_month()
returns table (
  month_start date,
  revenue     numeric,
  driver_pay  numeric
)
language sql
stable
as $$
  select
    date_trunc('month', delivered_at)::date as month_start,
    coalesce(sum(client_rate), 0) as revenue,
    coalesce(sum(driver_pay), 0) as driver_pay
  from public.loads
  where status = 'delivered'
    and delivered_at >= date_trunc('month', now()) - interval '5 months'
    and public.current_user_role() in ('owner', 'admin')
  group by date_trunc('month', delivered_at)
  order by month_start;
$$;
