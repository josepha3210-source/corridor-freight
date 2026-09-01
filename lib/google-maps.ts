/**
 * Google Maps Distance Matrix mileage tracking — the one piece of the
 * v2 transformation prompt's Phase 3c deliberately deferred (ROADMAP
 * §81) until the load/dispatch split itself was verified. Gated behind
 * an env var exactly the same way Stripe is (lib/stripe.ts) — no
 * account/API key exists yet, so every caller must check
 * isGoogleMapsConfigured() first and degrade to manual mileage entry
 * (already how Settlement's per-mile pay method works, §83) rather
 * than erroring.
 */
export function isGoogleMapsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY);
}

const METERS_PER_MILE = 1609.344;

export type DistanceResult = { miles: number; distanceText: string };

/**
 * Calls the Distance Matrix API server-side only (this must never run
 * client-side — it's the one place the API key exists). Origin/
 * destination are plain address/city strings, same free-text values
 * already stored on load_stops.location — no geocoding step of its own
 * since Distance Matrix accepts addresses directly.
 *
 * Returns null (not a thrown error) for "the API understood the
 * request but couldn't find a route" (e.g. a typo'd city) — that's a
 * data problem for the caller to surface as "couldn't calculate
 * mileage for this route," not a 500.
 */
export async function getDrivingDistance(
  origin: string,
  destination: string
): Promise<DistanceResult | null> {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    throw new Error(
      "GOOGLE_MAPS_API_KEY is not set — check isGoogleMapsConfigured() before calling getDrivingDistance()."
    );
  }

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origin);
  url.searchParams.set("destinations", destination);
  url.searchParams.set("units", "imperial");
  url.searchParams.set("key", process.env.GOOGLE_MAPS_API_KEY);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Distance Matrix API request failed (HTTP ${response.status}).`);
  }

  const data = await response.json();
  if (data.status !== "OK") {
    throw new Error(`Distance Matrix API error: ${data.status}${data.error_message ? ` — ${data.error_message}` : ""}`);
  }

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    return null;
  }

  return {
    miles: element.distance.value / METERS_PER_MILE,
    distanceText: element.distance.text,
  };
}
