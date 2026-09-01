import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isGoogleMapsConfigured, getDrivingDistance } from "@/lib/google-maps";

/**
 * Computes driving mileage between two locations for a load's pickup/
 * dropoff — the API key only ever lives server-side, called from
 * CreateLoadForm/LoadDetailClient's own "Calculate mileage" action, not
 * embedded in any client bundle. Same isGoogleMapsConfigured() gate and
 * 503-when-unconfigured shape as the Stripe checkout route.
 *
 * Owner/dispatcher/admin only — same boundary as who can create/edit a
 * load in the first place (RLS on loads/dispatches already enforces
 * this for the actual write; this route just computes a number, but
 * there's no reason to let a driver-role session call it).
 */
export async function POST(request: Request) {
  if (!isGoogleMapsConfigured()) {
    return NextResponse.json(
      { error: "Mileage calculation isn't configured yet." },
      { status: 503 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["owner", "dispatcher", "admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const origin = typeof body?.origin === "string" ? body.origin.trim() : "";
  const destination = typeof body?.destination === "string" ? body.destination.trim() : "";

  if (!origin || !destination) {
    return NextResponse.json(
      { error: "Both origin and destination are required." },
      { status: 400 }
    );
  }

  try {
    const result = await getDrivingDistance(origin, destination);
    if (!result) {
      return NextResponse.json(
        { error: "Couldn't calculate a route between those two locations." },
        { status: 422 }
      );
    }
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Mileage calculation failed." },
      { status: 502 }
    );
  }
}
