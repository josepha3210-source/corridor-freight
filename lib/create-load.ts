import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The one place a load gets created — since Phase 3c (0017) a load is
 * really three rows (loads, dispatches, two load_stops), and
 * create_load_with_dispatch() is the RPC that writes all of them as one
 * call so a load is never left half-created. This is a thin wrapper so
 * call sites don't have to remember the RPC's argument names.
 */
export async function createLoad(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    customerId: string;
    clientName: string;
    clientRate: number;
    notes?: string | null;
    driverId?: string | null;
    driverPay: number;
    pickupLocation: string;
    pickupAt: string | null;
    dropoffLocation: string;
    dropoffAt: string | null;
    /** From the Google Maps mileage calculation (0024) — optional, manual override always wins since this is just what the API prefilled. */
    miles?: number | null;
    /** Which truck actually ran this dispatch (0027) — separate from the driver's default/home truck (trucks.assigned_driver_id), since a driver can run a different one on a given day. Optional — most of this app's own history has no truck on record and that's a true "unknown," not an error. */
    truckId?: string | null;
  }
) {
  return supabase.rpc("create_load_with_dispatch", {
    p_company_id: input.companyId,
    p_customer_id: input.customerId,
    p_client_name: input.clientName,
    p_client_rate: input.clientRate,
    p_notes: input.notes || null,
    p_driver_id: input.driverId || null,
    p_driver_pay: input.driverPay,
    p_pickup_location: input.pickupLocation,
    p_pickup_at: input.pickupAt,
    p_dropoff_location: input.dropoffLocation,
    p_dropoff_at: input.dropoffAt,
    p_miles: input.miles ?? null,
    p_truck_id: input.truckId || null,
  });
}

/**
 * Calls the server-side mileage route (app/api/google-maps/distance) —
 * the API key never reaches the client. Returns null on any failure
 * (not configured, no route found, network error) so callers can just
 * fall back to manual entry rather than surfacing a scary error for
 * what's an optional convenience field.
 */
export async function calculateMileage(
  origin: string,
  destination: string
): Promise<{ miles: number; distanceText: string } | null> {
  try {
    const res = await fetch("/api/google-maps/distance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin, destination }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
