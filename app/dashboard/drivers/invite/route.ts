import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendDriverInvite } from "@/lib/send-driver-invite";

/**
 * Invites an existing drivers row to claim a portal login. Reuses the
 * same invites table + handle_new_user() mechanism as the dispatcher
 * invite in Settings (see 0004/0006 migrations) rather than a parallel
 * system — the only difference is role='driver' and driver_id pointing
 * at the record being claimed, both read by the trigger. The actual
 * insert-invite/send-email/rollback logic lives in sendDriverInvite,
 * shared with the Settings Team form's Driver option (§67/§68) so
 * there's exactly one implementation of "invite a driver."
 *
 * Re-checks the caller's role itself — the Drivers page only showing
 * this button to owners/dispatchers is a UX nicety, not the actual
 * guard, same reasoning as the Settings invite route.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const driverId = typeof body?.driverId === "string" ? body.driverId : "";

  if (!driverId) {
    return NextResponse.json({ error: "driverId is required." }, { status: 400 });
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
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile || !["owner", "dispatcher", "admin"].includes(profile.role)) {
    return NextResponse.json(
      { error: "Only an owner, admin, or dispatcher can invite a driver." },
      { status: 403 }
    );
  }

  // RLS already scopes this to the caller's own company, but the explicit
  // company_id check below still matters — it's what stops inviting a
  // driver record that RLS would have hidden anyway from resolving to
  // some other, unintended row.
  const { data: driver } = await supabase
    .from("drivers")
    .select("id, company_id, email, user_id")
    .eq("id", driverId)
    .single();

  if (!driver || driver.company_id !== profile.company_id) {
    return NextResponse.json({ error: "Driver not found." }, { status: 404 });
  }
  if (!driver.email) {
    return NextResponse.json(
      { error: "Add an email for this driver before inviting them." },
      { status: 400 }
    );
  }
  if (driver.user_id) {
    return NextResponse.json(
      { error: "This driver already has a login." },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const result = await sendDriverInvite({
    supabase,
    origin,
    companyId: profile.company_id,
    invitedByUserId: user.id,
    driverId: driver.id,
    driverEmail: driver.email,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
