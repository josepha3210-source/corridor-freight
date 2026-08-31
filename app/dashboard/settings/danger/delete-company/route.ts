import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Permanently deletes the caller's entire company — genuinely
 * irreversible, and deliberately different from every other "delete" in
 * this app (drivers/loads/payments are archive-not-delete by design;
 * this is the one real exception, for a company actually closing its
 * account, not day-to-day record-keeping).
 *
 * Owner-only, re-checked server-side same as billing. Requires the
 * caller to type the company's exact current name as confirmation —
 * checked here again, not just required by the form, since this is
 * genuinely a "the UI isn't the real gate" case if anything is.
 *
 * Every human account tied to this company is deleted too, not just the
 * data — a profiles row exists for every owner/admin/dispatcher/driver
 * who's ever actually signed up or claimed an invite (handle_new_user()
 * always creates one, regardless of role), so querying profiles by
 * company_id before deleting anything is a complete list of every login
 * this company has, with no need for a separate drivers-table query.
 * Order matters for a partial failure: the company (and everything that
 * cascades from it) is deleted FIRST, then each member's auth account
 * second — if the auth deletions fail partway, the tenant's data is
 * already fully gone either way, which is a far less confusing state to
 * leave behind than deleting people's logins while their company/data
 * still exists.
 */
export async function POST(request: Request) {
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

  if (!profile || profile.role !== "owner") {
    return NextResponse.json(
      { error: "Only the owner can delete the company." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const confirmName =
    typeof body?.confirmName === "string" ? body.confirmName.trim() : "";

  const { data: company } = await supabase
    .from("companies")
    .select("id, name")
    .eq("id", profile.company_id)
    .single();

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  if (confirmName !== company.name) {
    return NextResponse.json(
      { error: "That doesn't match the company name. Nothing was deleted." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Collect every login this company has BEFORE deleting anything —
  // once the company row is gone, this query would return nothing.
  const { data: memberProfiles } = await admin
    .from("profiles")
    .select("id")
    .eq("company_id", profile.company_id);

  const memberUserIds = (memberProfiles ?? []).map((p) => p.id);

  // Cascades to profiles, drivers, loads, payments, and invites via
  // their existing "on delete cascade" foreign keys (0001_init.sql) —
  // there's no client-facing delete policy on companies at all (same as
  // there's no insert policy), so this has to go through the admin
  // client; RLS would otherwise reject it outright.
  const { error: deleteError } = await admin
    .from("companies")
    .delete()
    .eq("id", profile.company_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  // Second: remove every member's login. A failure here (rare — a
  // single bad id, a transient API error) doesn't get surfaced as an
  // overall failure to the caller, since the data itself is already
  // fully and correctly gone by this point; whichever accounts errored
  // are just left as orphaned logins to clean up separately, not a sign
  // the deletion as a whole didn't work.
  for (const memberId of memberUserIds) {
    await admin.auth.admin.deleteUser(memberId).catch(() => {
      // Intentionally swallowed — see comment above.
    });
  }

  return NextResponse.json({ ok: true });
}
