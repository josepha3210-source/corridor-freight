import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDriver } from "@/lib/create-driver";
import { sendDriverInvite } from "@/lib/send-driver-invite";

const INVITABLE_ROLES = ["dispatcher", "admin", "driver"] as const;

/**
 * The only place team invites actually happen. This re-checks the
 * caller's role itself — the Settings page only *showing* the invite
 * form to owner/admin/dispatcher (and only offering the roles it does)
 * is a UX nicety, not a security boundary, since nothing stops a request
 * from being sent here directly. The RLS insert policy on invites (0007)
 * independently re-derives the same role requirement, so this check and
 * that policy have to agree — they're not each other's only line of
 * defense.
 *
 * role='driver' is a two-step flow (§67/§68): create the drivers row
 * (createDriver — the same insert AddDriverForm does), then immediately
 * invite it (sendDriverInvite — the same mechanism the Drivers page's
 * "Invite" button uses). If the invite send fails, the drivers row is
 * NOT rolled back — that matches what already happens when someone adds
 * a driver on the Drivers page and a separate invite click fails: the
 * driver row stays, uninvited, until someone retries.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const role = body?.role;
  const fullName = typeof body?.fullName === "string" ? body.fullName.trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }
  if (!INVITABLE_ROLES.includes(role)) {
    return NextResponse.json(
      { error: "Role must be dispatcher, admin, or driver." },
      { status: 400 }
    );
  }
  if (role === "driver" && !fullName) {
    return NextResponse.json(
      { error: "Full name is required to invite a driver." },
      { status: 400 }
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
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  const allowedCallerRoles =
    role === "driver" ? ["owner", "dispatcher", "admin"] : ["owner", "admin"];

  if (!profile || !allowedCallerRoles.includes(profile.role)) {
    return NextResponse.json(
      {
        error:
          role === "driver"
            ? "Only an owner, admin, or dispatcher can invite a driver."
            : "Only an owner or admin can invite teammates.",
      },
      { status: 403 }
    );
  }

  if (role === "driver") {
    // Step 1: create the drivers row — same shape AddDriverForm inserts.
    const { data: driver, error: driverError } = await createDriver(supabase, {
      companyId: profile.company_id,
      fullName,
      email,
    });

    if (driverError || !driver) {
      return NextResponse.json(
        { error: driverError?.message ?? "Could not create the driver." },
        { status: 400 }
      );
    }

    // Step 2: immediately invite the driver just created. Not rolled
    // back on failure — see the function comment above.
    const origin = new URL(request.url).origin;
    const result = await sendDriverInvite({
      supabase,
      origin,
      companyId: profile.company_id,
      invitedByUserId: user.id,
      driverId: driver.id,
      driverEmail: email,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  }

  // Recorded first (RLS-checked: caller is owner/admin, invited role is
  // dispatcher/admin — see 0007) so handle_new_user() has something
  // authoritative to match the invited user's email against — see the
  // 0004 migration for why this can't just be metadata passed to
  // inviteUserByEmail below.
  const { data: invite, error: insertError } = await supabase
    .from("invites")
    .insert({ company_id: profile.company_id, email, role, invited_by: user.id })
    .select()
    .single();

  if (insertError) {
    // Most likely cause: the unique index on (company_id, email) for
    // still-pending invites — i.e. someone's already been invited.
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  const admin = createAdminClient();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    email,
    // Same callback route signup confirmation already uses, but routed
    // to a password-setup step first — an invited user has no password
    // yet, only the session this magic link grants them.
    { redirectTo: `${origin}/auth/callback?next=/auth/set-password` }
  );

  if (inviteError) {
    await supabase.from("invites").delete().eq("id", invite.id);
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
