-- Corridor Freight — Google Maps Distance Matrix mileage tracking
-- The one piece of Phase 3c deliberately deferred until the load/
-- dispatch split itself was verified (ROADMAP §81). Adds `miles` to
-- `dispatches` (operational data, same table driver_pay lives on — a
-- customer being billed doesn't care how far the truck drove, but the
-- driver's pay and IFTA both do) and threads it through
-- create_load_with_dispatch() as one more optional value, computed by
-- the app calling the new /api/google-maps/distance route (gated
-- behind GOOGLE_MAPS_API_KEY, same isGoogleMapsConfigured() pattern as
-- Stripe) before submitting — never computed inside SQL itself, since
-- Postgres can't make an outbound HTTP call on its own here.
--
-- This is exactly the field Settlement's per-mile pay method (0019,
-- lib/create-settlement.ts) already has a manual-entry fallback for —
-- CreateSettlementForm now prefills from this column instead of
-- starting blank, still editable, not a redesign.

alter table public.dispatches
  add column miles numeric(10, 1) check (miles is null or miles >= 0);

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
  p_miles           numeric default null
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

  insert into public.dispatches (company_id, load_id, driver_id, status, driver_pay, miles)
  values (p_company_id, new_load_id, p_driver_id, initial_status, coalesce(p_driver_pay, 0), p_miles)
  returning id into new_dispatch_id;

  insert into public.load_stops (company_id, dispatch_id, stop_type, sequence, location, scheduled_at)
  values
    (p_company_id, new_dispatch_id, 'pickup', 1, p_pickup_location, p_pickup_at),
    (p_company_id, new_dispatch_id, 'dropoff', 2, p_dropoff_location, p_dropoff_at);

  return new_load_id;
end;
$$;

-- loads_with_dispatch (0017) — add miles to the read-compatibility view
-- so consumers (LoadDetailClient, CreateSettlementForm's eligible-loads
-- fetch) can read it the same way they already read driver_pay.
-- `miles` has to go at the END of the select list, not wherever reads
-- most naturally next to driver_pay — CREATE OR REPLACE VIEW refuses
-- to reorder or insert among a view's existing output columns, only
-- append after them.
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
  disp.miles
from public.loads l
join public.dispatches disp on disp.load_id = l.id
left join public.drivers drv on drv.id = disp.driver_id
left join public.load_stops pickup on pickup.dispatch_id = disp.id and pickup.stop_type = 'pickup'
left join public.load_stops dropoff on dropoff.dispatch_id = disp.id and dropoff.stop_type = 'dropoff';
