import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Backhaul awareness (v2 prompt Phase 7) — when a dispatcher assigns a
 * driver to a load, this surfaces whether that driver's last known
 * location (their most recent dropoff, in schedule order) matches
 * where the new load actually picks up. A mismatch means the driver
 * has to run empty ("deadhead") from wherever they last dropped off to
 * this load's pickup before they can even start it — worth knowing
 * before committing to the assignment, not after the driver's already
 * on the road.
 *
 * This is a location-mismatch check, not a distance calculation. How
 * far that deadhead actually is isn't knowable without a real
 * geocoding/routing lookup (Google Maps Distance Matrix — see
 * lib/google-maps.ts — gated behind GOOGLE_MAPS_API_KEY, not currently
 * configured), so this deliberately never invents a mileage figure.
 * It surfaces the honest fact ("different location") and names both
 * locations so a dispatcher can judge the distance themselves — same
 * tiered-honesty pattern as the IFTA calculator and HVUT stub: build
 * the real structure now, degrade openly instead of fabricating a
 * number, and it's a small, additive change to call getDrivingDistance
 * here later once a Maps key exists.
 *
 * "Most relevant prior dispatch" = the driver's own dispatch whose
 * dropoff is scheduled latest but still at-or-before this load's own
 * pickup time — i.e. their actual last stop before this one, in
 * schedule order. Falls back to their single most recent dropoff
 * overall when this load has no pickup time yet, or none of the
 * driver's other dispatches drop off before it (e.g. this new load is
 * actually scheduled first) — still useful context, just not as
 * precise a match.
 */
export type PriorDropoff = {
  location: string;
  loadNumber: string;
  dropoffAt: string | null;
};

export async function findPriorDropoffForDriver(
  supabase: SupabaseClient,
  driverId: string,
  opts: { excludeDispatchId?: string; beforeIso?: string | null }
): Promise<PriorDropoff | null> {
  if (!driverId) return null;

  let query = supabase
    .from("loads_with_dispatch")
    .select("dispatch_id, load_number, dropoff_location, dropoff_at")
    .eq("driver_id", driverId)
    .neq("status", "cancelled")
    .not("dropoff_location", "is", null)
    .order("dropoff_at", { ascending: false, nullsFirst: false })
    .limit(10);

  if (opts.excludeDispatchId) {
    query = query.neq("dispatch_id", opts.excludeDispatchId);
  }

  const { data } = await query;
  if (!data || data.length === 0) return null;

  if (opts.beforeIso) {
    const beforeTime = new Date(opts.beforeIso).getTime();
    const before = data.find(
      (d) => d.dropoff_at && new Date(d.dropoff_at).getTime() <= beforeTime
    );
    if (before) {
      return {
        location: before.dropoff_location as string,
        loadNumber: before.load_number as string,
        dropoffAt: before.dropoff_at,
      };
    }
  }

  const mostRecent = data[0];
  return {
    location: mostRecent.dropoff_location as string,
    loadNumber: mostRecent.load_number as string,
    dropoffAt: mostRecent.dropoff_at,
  };
}

/** Same case/whitespace-insensitive exact match the lane-grouping and
 * lane-history features use, so "does this count as the same place"
 * answers consistently everywhere in the app. */
export function locationsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
