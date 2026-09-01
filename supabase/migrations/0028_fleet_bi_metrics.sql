-- Corridor Freight — v2 prompt update: real fleet BI metrics
-- One aggregate function alongside dashboard_summary()/
-- dashboard_revenue_by_month() (0005/0007/0015/0017), same
-- conventions: NOT security definer (runs as the caller, so RLS on
-- dispatches/loads/trucks/load_stops scopes every row exactly as if
-- queried directly), and the owner/admin gate for the financial metric
-- (revenue per mile) lives inside the function itself, same
-- defense-in-depth pattern as dashboard_summary()'s revenue_total.
--
-- Three metrics, deliberately not five — the full v2 prompt list also
-- asked for empty-mile percentage and lane profitability. Empty-mile %
-- needs to know the deadhead leg between one dispatch's dropoff and the
-- driver's *next* dispatch's pickup, which this app doesn't track
-- anywhere (dispatches.miles, 0024, is the loaded-miles figure for one
-- dispatch, not a route graph across dispatches) — presenting a real-
-- looking percentage computed from nothing would be exactly the kind
-- of fabricated number this build has avoided everywhere else (the
-- HVUT tax table, IFTA per-jurisdiction miles). Flagged as a real
-- product decision rather than guessed at: see ROADMAP for the actual
-- question this needs answered before it can be built honestly. Lane
-- profitability is its own real Reports page, not a single number, and
-- is built separately.
create function public.fleet_bi_metrics()
returns table (
  revenue_per_mile        numeric,
  revenue_per_mile_prior  numeric,
  on_time_delivery_rate   numeric,
  on_time_sample_size     bigint,
  fleet_utilization_rate  numeric,
  active_truck_count      bigint,
  utilized_truck_count    bigint
)
language sql
stable
as $$
  select
    -- Revenue per mile — trailing 30 days, delivered loads with a real
    -- (non-null, positive) miles figure only; a load with no mileage on
    -- record is excluded from both the numerator and denominator
    -- rather than silently treated as 0 miles (which would make the
    -- number meaningless, not just imprecise). Financial, so owner/
    -- admin only — same boundary as revenue_total elsewhere.
    case when public.current_user_role() in ('owner', 'admin') then (
      select case when sum(d.miles) > 0 then sum(l.client_rate) / sum(d.miles) else null end
      from public.dispatches d
      join public.loads l on l.id = d.load_id
      where d.status = 'delivered'
        and d.delivered_at >= now() - interval '30 days'
        and d.miles is not null and d.miles > 0
    ) else null end as revenue_per_mile,

    -- Same computation, the prior 30-day window — lets the dashboard
    -- show a trend (up/down) instead of a bare number with no context.
    case when public.current_user_role() in ('owner', 'admin') then (
      select case when sum(d.miles) > 0 then sum(l.client_rate) / sum(d.miles) else null end
      from public.dispatches d
      join public.loads l on l.id = d.load_id
      where d.status = 'delivered'
        and d.delivered_at >= now() - interval '60 days'
        and d.delivered_at < now() - interval '30 days'
        and d.miles is not null and d.miles > 0
    ) else null end as revenue_per_mile_prior,

    -- On-time delivery rate — delivered at or before the dropoff stop's
    -- own scheduled time, trailing 30 days. Operational, not financial
    -- (visible to dispatchers too, same as active driver counts
    -- elsewhere on this dashboard). Loads with no dropoff time set are
    -- excluded — there's nothing to have been "on time" against.
    (
      select case when count(*) > 0
        then 100.0 * count(*) filter (where d.delivered_at <= dropoff.scheduled_at) / count(*)
        else null
      end
      from public.dispatches d
      join public.load_stops dropoff on dropoff.dispatch_id = d.id and dropoff.stop_type = 'dropoff'
      where d.status = 'delivered'
        and d.delivered_at >= now() - interval '30 days'
        and dropoff.scheduled_at is not null
    ) as on_time_delivery_rate,

    (
      select count(*)
      from public.dispatches d
      join public.load_stops dropoff on dropoff.dispatch_id = d.id and dropoff.stop_type = 'dropoff'
      where d.status = 'delivered'
        and d.delivered_at >= now() - interval '30 days'
        and dropoff.scheduled_at is not null
    ) as on_time_sample_size,

    -- Fleet utilization — % of active trucks with a non-cancelled
    -- dispatch scheduled (pickup or dropoff) in the last 7 days. Needed
    -- dispatches.truck_id (0027, added specifically for this) to exist
    -- at all — trucks.assigned_driver_id is a default/home assignment,
    -- not a per-dispatch fact, so it can't stand in for "which truck
    -- actually ran this."
    case when (select count(*) from public.trucks where status = 'active') > 0 then
      100.0 * (
        select count(distinct t.id)
        from public.trucks t
        join public.dispatches d on d.truck_id = t.id and d.status <> 'cancelled'
        join public.load_stops ls on ls.dispatch_id = d.id
        where t.status = 'active'
          and ls.scheduled_at >= now() - interval '7 days'
          and ls.scheduled_at <= now()
      ) / (select count(*) from public.trucks where status = 'active')
    else null end as fleet_utilization_rate,

    (select count(*) from public.trucks where status = 'active') as active_truck_count,

    (
      select count(distinct t.id)
      from public.trucks t
      join public.dispatches d on d.truck_id = t.id and d.status <> 'cancelled'
      join public.load_stops ls on ls.dispatch_id = d.id
      where t.status = 'active'
        and ls.scheduled_at >= now() - interval '7 days'
        and ls.scheduled_at <= now()
    ) as utilized_truck_count;
$$;
