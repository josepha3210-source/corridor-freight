-- Corridor Freight — demo/preview data
-- 27 drivers + 14 loads spread across a realistic mix of statuses, so the
-- dashboard actually has something to show in every section instead of
-- one status repeated 14 times. Not a migration (not numbered, not part
-- of the schema) — this is throwaway preview data for "tom trucking".
--
-- Mix, and why: 2 overdue pickups + 2 overdue deliveries (Action
-- Required), 3 unassigned (Unassigned), 2 pickups + 2 deliveries later
-- today (Today), 2 delivered with no payment yet (Payments Awaiting),
-- 1 delivered and already paid (so Payroll's "Per-driver statements"
-- has something too, not just the awaiting-payment list) = 14 loads.
--
-- Safe to remove later: loads/drivers/payments only ever archive or
-- cancel through the app (0002/0003 lock out hard delete at the RLS
-- level) — there's no undo button for this script itself, so don't run
-- it twice without meaning to (it'll just add 27 more drivers).

with target_company as (
  -- Pinned to "tom trucking"'s actual row id rather than matching by name —
  -- a name match silently found nothing (likely invisible whitespace in
  -- the stored value), so this is the reliable version.
  select 'fe391b20-5bde-4203-b224-39a9bb9c6443'::uuid as id
),
new_drivers as (
  insert into public.drivers (company_id, full_name, phone, status)
  select (select id from target_company), d.name, d.phone, 'active'
  from (values
    ('Marcus Webb',       '555-0101'),
    ('Sarah Chen',        '555-0102'),
    ('Derek Holloway',    '555-0103'),
    ('Angela Reyes',      '555-0104'),
    ('Tyrell Jackson',    '555-0105'),
    ('Emily Foster',      '555-0106'),
    ('Carlos Mendoza',    '555-0107'),
    ('Brittany Cole',     '555-0108'),
    ('Jason Whitfield',   '555-0109'),
    ('Monica Delgado',    '555-0110'),
    ('Kevin Osei',        '555-0111'),
    ('Rachel Kim',        '555-0112'),
    ('Anthony Russo',     '555-0113'),
    ('Diana Patel',       '555-0114'),
    ('Brandon Lutz',      '555-0115'),
    ('Chelsea Moore',     '555-0116'),
    ('Isaiah Brooks',     '555-0117'),
    ('Natalie Vance',     '555-0118'),
    ('Ronald Pierce',     '555-0119'),
    ('Vanessa Ortiz',     '555-0120'),
    ('Gregory Chan',      '555-0121'),
    ('Paula Simmons',     '555-0122'),
    ('Nathan Boyd',       '555-0123'),
    ('Kimberly Ash',      '555-0124'),
    ('Omar Farouk',       '555-0125'),
    ('Stephanie Nash',    '555-0126'),
    ('Victor Alvarez',    '555-0127')
  ) as d(name, phone)
  returning id, full_name
),
new_loads as (
  insert into public.loads (
    company_id, driver_id, client_name, pickup_location, pickup_at,
    dropoff_location, dropoff_at, status, client_rate, driver_pay,
    delivered_at, signed_by_name
  )
  select
    (select id from target_company),
    (select id from new_drivers where full_name = l.driver_name),
    l.client_name, l.pickup_location, l.pickup_at, l.dropoff_location,
    l.dropoff_at, l.status, l.client_rate, l.driver_pay,
    l.delivered_at, l.signed_by_name
  from (values
    -- overdue pickups: assigned, pickup already in the past
    ('Marcus Webb', 'Midwest Produce Co', 'Chicago, IL', now() - interval '5 hours', 'Indianapolis, IN', now() + interval '3 hours', 'assigned', 1450.00, 950.00, null::timestamptz, null::text),
    ('Sarah Chen', 'Harborline Freight', 'Cleveland, OH', now() - interval '9 hours', 'Columbus, OH', now() + interval '1 hour', 'assigned', 980.00, 620.00, null, null),
    -- overdue deliveries: in transit, dropoff already in the past
    ('Derek Holloway', 'BlueRock Distribution', 'Memphis, TN', now() - interval '2 days', 'Nashville, TN', now() - interval '1 day', 'in_transit', 1120.00, 700.00, null, null),
    ('Angela Reyes', 'Summit Building Supply', 'Denver, CO', now() - interval '1 day 4 hours', 'Salt Lake City, UT', now() - interval '6 hours', 'in_transit', 1875.00, 1250.00, null, null),
    -- unassigned
    (null, 'Pioneer Foods', 'Atlanta, GA', now() + interval '1 day', 'Jacksonville, FL', now() + interval '1 day 8 hours', 'unassigned', 1300.00, 850.00, null, null),
    (null, 'Coastal Retail Group', 'Tampa, FL', now() + interval '2 days', 'Orlando, FL', now() + interval '2 days 4 hours', 'unassigned', 640.00, 400.00, null, null),
    (null, 'Redwood Manufacturing', 'Sacramento, CA', now() + interval '3 days', 'Reno, NV', now() + interval '3 days 5 hours', 'unassigned', 920.00, 600.00, null, null),
    -- today's pickups: assigned, pickup later today
    ('Tyrell Jackson', 'Vantage Auto Parts', 'Dallas, TX', now() + interval '3 hours', 'Houston, TX', now() + interval '9 hours', 'assigned', 1050.00, 680.00, null, null),
    ('Emily Foster', 'Lonestar Beverage', 'San Antonio, TX', now() + interval '5 hours', 'Austin, TX', now() + interval '10 hours', 'assigned', 715.00, 460.00, null, null),
    -- today's deliveries: in transit, dropoff later today
    ('Carlos Mendoza', 'Apex Hardware', 'Phoenix, AZ', now() - interval '6 hours', 'Tucson, AZ', now() + interval '2 hours', 'in_transit', 830.00, 540.00, null, null),
    ('Brittany Cole', 'Northgate Logistics', 'Portland, OR', now() - interval '8 hours', 'Seattle, WA', now() + interval '4 hours', 'in_transit', 1190.00, 780.00, null, null),
    -- delivered, no payment yet (Payments Awaiting)
    ('Jason Whitfield', 'Copper State Textiles', 'Albuquerque, NM', now() - interval '3 days', 'El Paso, TX', now() - interval '2 days', 'delivered', 1400.00, 900.00, now() - interval '2 days', 'R. Alvarado'),
    ('Monica Delgado', 'Great Lakes Paper Co', 'Detroit, MI', now() - interval '4 days', 'Toledo, OH', now() - interval '3 days', 'delivered', 760.00, 500.00, now() - interval '3 days', 'T. Nguyen'),
    -- delivered and already paid (Payroll per-driver statements)
    ('Kevin Osei', 'Riverside Grain', 'Kansas City, MO', now() - interval '6 days', 'St. Louis, MO', now() - interval '5 days', 'delivered', 1080.00, 700.00, now() - interval '5 days', 'J. Park')
  ) as l(driver_name, client_name, pickup_location, pickup_at, dropoff_location, dropoff_at, status, client_rate, driver_pay, delivered_at, signed_by_name)
  returning id, client_name, driver_id, driver_pay
)
insert into public.payments (company_id, load_id, driver_id, amount, status, paid_at)
select
  (select id from target_company),
  id, driver_id, driver_pay, 'paid', now() - interval '4 days'
from new_loads
where client_name = 'Riverside Grain';
