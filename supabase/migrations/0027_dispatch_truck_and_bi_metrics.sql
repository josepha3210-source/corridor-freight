-- Corridor Freight — v2 prompt update: real fleet BI metrics
-- ----------------------------------------------------------------------------
-- Building "fleet utilization" (% of active trucks with a dispatch in
-- the last 7 days) surfaced a real gap: `dispatches` has a driver_id
-- but no truck_id — nothing in this app actually records which truck
-- ran a given dispatch, only which driver did (trucks.assigned_driver_id
-- is a default/home assignment, not a per-dispatch fact — a driver can
-- run a different truck than their usual one on a given day). Rather
-- than approximate fleet utilization from a driver's *assigned* truck
-- (a proxy, not the ground truth — exactly the kind of "presents a
-- guess as a real number" trap this build has avoided everywhere else,
-- e.g. the HVUT tax table and IFTA per-jurisdiction miles), this adds
-- the real column.
--
-- Nullable — every dispatch created before this migration has no truck
-- on record and that's a true "unknown," not an error; nothing backfills
-- a guess here.

alter table public.dispatches
  add column truck_id uuid references public.trucks (id) on delete set null;

create index dispatches_truck_id_idx on public.dispatches (truck_id);

create or replace function public.create_load_with_dispatch(
  p_company_id      uuid,
  p_customer_id     uuid,
  p_client_name     text,
  p_client_rate     numeric,
  p_notes           text,
  p_driver_id       uuid,
  p_driver_pay      numeric,
  p_pickup_location text,
  p_pickup_at       timestamptz,
  p_dropoff_location text,
  p_dropoff_at      timestamptz,
  p_miles           numeric default null,
  p_truck_id        uuid default null
)
returns uuid
language plpgsql
as $$
declare
  new_load_id     uuid;
  new_dispatch_id uuid;
  initial_status  text := case when p_driver_id is null then 'unassigned' else 'assigned' end;
begin
  insert into public.loads (company_id, customer_id, client_name, client_rate, notes)
  values (p_company_id, p_customer_id, p_client_name, coalesce(p_client_rate, 0), p_notes)
  returning id into new_load_id;

  insert into public.dispatches (company_id, load_id, driver_id, status, driver_pay, miles, truck_id)
  values (p_company_id, new_load_id, p_driver_id, initial_status, coalesce(p_driver_pay, 0), p_miles, p_truck_id)
  returning id into new_dispatch_id;

  insert into public.load_stops (company_id, dispatch_id, stop_type, sequence, location, scheduled_at)
  values
    (p_company_id, new_dispatch_id, 'pickup', 1, p_pickup_location, p_pickup_at),
    (p_company_id, new_dispatch_id, 'dropoff', 2, p_dropoff_location, p_dropoff_at);

  return new_load_id;
end;
$$;

-- loads_with_dispatch (0017, extended 0024) — truck_id and plate
-- appended at the end again, same CREATE OR REPLACE VIEW column-order
-- rule as 0024's own comment explains.
create or replace view public.loads_with_dispatch as
select
  l.id,
  l.company_id,
  l.load_number,
  l.customer_id,
  l.client_name,
  l.client_rate,
  l.notes,
  l.created_at,
  disp.id as dispatch_id,
  disp.driver_id,
  drv.full_name as driver_name,
  disp.status,
  disp.driver_pay,
  disp.signed_by_name,
  disp.signature_data,
  disp.delivered_at,
  pickup.location as pickup_location,
  pickup.scheduled_at as pickup_at,
  dropoff.location as dropoff_location,
  dropoff.scheduled_at as dropoff_at,
  disp.miles,
  disp.truck_id,
  trk.plate_number as truck_plate
from public.loads l
join public.dispatches disp on disp.load_id = l.id
left join public.drivers drv on drv.id = disp.driver_id
left join public.trucks trk on trk.id = disp.truck_id
left join public.load_stops pickup on pickup.dispatch_id = disp.id and pickup.stop_type = 'pickup'
left join public.load_stops dropoff on dropoff.dispatch_id = disp.id and dropoff.stop_type = 'dropoff';
