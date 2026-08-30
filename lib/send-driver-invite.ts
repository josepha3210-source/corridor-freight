import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The one place a driver-role invite actually gets sent — insert the
 * invites row, then call admin.inviteUserByEmail, rolling back only the
 * invite row (never the drivers row) if the email fails to send. Used by
 * both the Drivers page's "Invite" button (an existing drivers row
 * that's missing a login) and the Settings Team form's Driver option (a
 * drivers row just created in the same request) — same mechanism either
 * way, so this is the only implementation of it.
 */
export async function sendDriverInvite({
  supabase,
  origin,
  companyId,
  invitedByUserId,
  driverId,
  driverEmail,
}: {
  supabase: SupabaseClient;
  origin: string;
  companyId: string;
  invitedByUserId: string;
  driverId: string;
  driverEmail: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: invite, error: insertError } = await supabase
    .from("invites")
    .insert({
      company_id: companyId,
      email: driverEmail,
      invited_by: invitedByUserId,
      role: "driver",
      driver_id: driverId,
    })
    .select()
    .single();

  if (insertError) {
    return { ok: false, status: 400, error: insertError.message };
  }

  const admin = createAdminClient();
  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(driverEmail, {
    redirectTo: `${origin}/auth/callback?next=/auth/set-password`,
  });

  if (inviteError) {
    // Roll back only the invite — the drivers row stays, same as the
    // Drivers-page flow leaving an uninvited driver row behind when its
    // separate "Invite" click fails.
    await supabase.from("invites").delete().eq("id", invite.id);
    return { ok: false, status: 400, error: inviteError.message };
  }

  return { ok: true };
}
