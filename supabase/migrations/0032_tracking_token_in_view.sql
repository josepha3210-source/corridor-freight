-- Corridor Freight — expose dispatches.tracking_token (0031) through
-- loads_with_dispatch so LoadDetailClient can render a "Copy tracking
-- link" action without a bespoke query. Appended at the very end of
-- the select list again — same CREATE OR REPLACE VIEW column-order
-- rule 0024/0027 already documented.
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
  trk.plate_number as truck_plate,
  disp.tracking_token
from public.loads l
join public.dispatches disp on disp.load_id = l.id
left join public.drivers drv on drv.id = disp.driver_id
left join public.trucks trk on trk.id = disp.truck_id
left join public.load_stops pickup on pickup.dispatch_id = disp.id and pickup.stop_type = 'pickup'
left join public.load_stops dropoff on dropoff.dispatch_id = disp.id and dropoff.stop_type = 'dropoff';
