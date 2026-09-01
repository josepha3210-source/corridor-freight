-- Corridor Freight — v2 prompt Phase 7: customer-facing tracking
-- A public, no-login tracking link per dispatch — the single most-
-- cited feature across modern dispatch platforms per the prompt's own
-- research, and buildable without real GPS/telematics hardware: status
-- + an ETA from the dispatch's own scheduled dropoff time, degrading
-- honestly ("not yet available") rather than faking a number.
--
-- tracking_token is a real, unguessable per-dispatch secret (a second
-- random uuid, deliberately not dispatches.id itself — id is already
-- referenced all over the app in ways that could leak it, e.g. a
-- browser history entry or a support screenshot; this token exists
-- for exactly one purpose and can be rotated independently of the row
-- it's on). Knowing the token IS the authorization for this one
-- read — same reasoning as a Stripe webhook's signature or any
-- unguessable share link — so this doesn't add an RLS policy granting
-- anon broad access to `dispatches` (that would let anyone enumerate
-- every dispatch by guessing IDs); instead a SECURITY DEFINER function
-- looks up exactly one dispatch by its token and returns only
-- operational fields — no rate, no driver pay, no driver's name. A
-- shipper tracking their freight has no business seeing what the
-- carrier pays its driver.
alter table public.dispatches
  add column tracking_token uuid not null default gen_random_uuid();

create unique index dispatches_tracking_token_idx on public.dispatches (tracking_token);

create function public.public_track_dispatch(p_token uuid)
returns table (
  load_number     text,
  status          text,
  pickup_location text,
  pickup_at       timestamptz,
  dropoff_location text,
  dropoff_at      timestamptz,
  delivered_at    timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.load_number,
    d.status,
    pickup.location,
    pickup.scheduled_at,
    dropoff.location,
    dropoff.scheduled_at,
    d.delivered_at
  from public.dispatches d
  join public.loads l on l.id = d.load_id
  left join public.load_stops pickup on pickup.dispatch_id = d.id and pickup.stop_type = 'pickup'
  left join public.load_stops dropoff on dropoff.dispatch_id = d.id and dropoff.stop_type = 'dropoff'
  where d.tracking_token = p_token;
$$;

-- Anonymous visitors need to be able to call this function at all —
-- SECURITY DEFINER means the function itself bypasses dispatches' RLS,
-- but Postgres still checks whether the calling role has EXECUTE on
-- the function in the first place.
grant execute on function public.public_track_dispatch(uuid) to anon;
