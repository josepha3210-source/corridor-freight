-- Corridor Freight — Phase 7: driver scorecards
--
-- Rolls up three things this app already records into one per-driver
-- view: on-time delivery rate, POD/signature compliance rate, and DVIR
-- pass rate — plus a new manual incident log for anything that isn't
-- captured by an existing table (a late call-in, a customer complaint,
-- a safety observation). No new data collection for the first three;
-- this is entirely aggregation of dispatches/load_stops/dvir_reports
-- that already exist.

-- ============================================================================
-- driver_incidents — a manual, staff-authored log entry against a
-- driver. Immutable once created, same as dvir_reports and a
-- delivery's signature: no update/delete policy at all. A mistaken or
-- outdated entry gets corrected with a follow-up entry, not silently
-- edited or removed — the same reasoning already applied to every
-- other compliance-flavored record in this app (a scorecard used for
-- pay or performance decisions shouldn't be quietly rewritable).
-- ============================================================================

create table public.driver_incidents (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  driver_id     uuid not null references public.drivers (id) on delete cascade,

  category      text not null check (category in ('safety', 'compliance', 'conduct', 'other')),
  occurred_at   date not null default current_date,
  description   text not null,

  created_by    uuid references auth.users (id),
  created_at    timestamptz not null default now()
);

create index driver_incidents_company_id_idx on public.driver_incidents (company_id);
create index driver_incidents_driver_id_idx  on public.driver_incidents (driver_id);

alter table public.driver_incidents enable row level security;

create policy "select own company driver incidents"
  on public.driver_incidents for select
  using (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

create policy "insert own company driver incidents"
  on public.driver_incidents for insert
  with check (company_id = public.current_company_id() and public.current_user_role() in ('owner', 'dispatcher', 'admin'));

-- ============================================================================
-- driver_scorecard() — not security definer, runs as the caller so the
-- existing dispatches/load_stops/dvir_reports RLS policies apply
-- exactly as they would to a hand-written query. Only returns numbers
-- for a driver whose rows the caller could already see individually.
--
-- Each rate comes with its own sample size, and is null (not 0) when
-- the sample is empty — an owner should see "no delivered loads yet",
-- never a fabricated 0% that reads as a real, poor track record.
-- ============================================================================

create or replace function public.driver_scorecard(p_driver_id uuid)
returns table (
  delivered_load_count   bigint,
  on_time_rate            numeric,
  on_time_sample_size     bigint,
  pod_compliance_rate     numeric,
  pod_sample_size         bigint,
  dvir_pass_rate          numeric,
  dvir_sample_size        bigint
)
language sql
stable
as $$
  with delivered as (
    select
      d.id,
      d.delivered_at,
      d.signature_data,
      ls_dropoff.scheduled_at as dropoff_scheduled_at
    from public.dispatches d
    join public.load_stops ls_dropoff
      on ls_dropoff.dispatch_id = d.id and ls_dropoff.stop_type = 'dropoff'
    where d.driver_id = p_driver_id
      and d.status = 'delivered'
  ),
  on_time as (
    select count(*) filter (
      where dropoff_scheduled_at is not null and delivered_at <= dropoff_scheduled_at
    ) as on_time_count,
    count(*) filter (where dropoff_scheduled_at is not null) as sample_size
    from delivered
  ),
  pod as (
    select
      count(*) filter (where signature_data is not null and signature_data <> '') as compliant_count,
      count(*) as sample_size
    from delivered
  ),
  dvir as (
    select
      count(*) filter (where satisfactory) as pass_count,
      count(*) as sample_size
    from public.dvir_reports
    where driver_id = p_driver_id
  )
  select
    (select count(*) from delivered),
    case when on_time.sample_size > 0 then on_time.on_time_count::numeric / on_time.sample_size else null end,
    on_time.sample_size,
    case when pod.sample_size > 0 then pod.compliant_count::numeric / pod.sample_size else null end,
    pod.sample_size,
    case when dvir.sample_size > 0 then dvir.pass_count::numeric / dvir.sample_size else null end,
    dvir.sample_size
  from on_time, pod, dvir;
$$;

grant execute on function public.driver_scorecard(uuid) to authenticated;
