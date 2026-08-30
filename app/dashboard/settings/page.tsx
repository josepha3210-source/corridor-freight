import { requireProfile } from "@/lib/current-profile";
import { CompanyForm } from "./CompanyForm";
import { ProfileForm } from "./ProfileForm";
import { InviteForm } from "./InviteForm";
import { CancelInviteButton } from "./CancelInviteButton";
import { BillingSection } from "./BillingSection";
import type { Plan } from "@/lib/billing-format";

type Teammate = { id: string; full_name: string | null; role: string };
type PendingInvite = { id: string; email: string; role: string };

/**
 * Team is gated here, server-side, not just hidden with CSS: a
 * dispatcher's request never runs the queries below or generates that
 * section's markup, because isOwnerOrAdmin is checked before any of it
 * executes. The invite Route Handler and the invites RLS policy (0007)
 * both re-check independently anyway — this gate is about not leaking
 * team data to a dispatcher's browser, not the actual security boundary
 * for the invite action itself.
 */
export default async function SettingsPage() {
  const { supabase, user, profile } = await requireProfile();
  const isOwnerOrAdmin = profile?.role === "owner" || profile?.role === "admin";
  // A dispatcher never sees the Team roster/pending-invites list below
  // (that stays owner/admin only, same as before) but can still invite a
  // driver from here — per §66's invites RLS policy, owner/admin/
  // dispatcher can all invite a driver, only owner/admin can invite a
  // dispatcher or admin. Driver-role users never reach this page at all
  // (redirected to /driver in the dashboard layout), so this is really
  // just "is this caller allowed to invite anyone at all" for the two
  // remaining roles.
  const isDispatcher = profile?.role === "dispatcher";
  const inviteRoles: Array<"dispatcher" | "admin" | "driver"> = isOwnerOrAdmin
    ? ["dispatcher", "admin", "driver"]
    : ["driver"];
  // Billing is narrower than every other owner+admin boundary on this
  // page — this is the one thing §66 explicitly carved the admin role
  // out of. Not "isOwnerOrAdmin", genuinely owner-only.
  const isOwner = profile?.role === "owner";

  const { data: company } = await supabase
    .from("companies")
    .select(
      "id, name, phone, address, subscription_status, plan_id, plans ( id, name, driver_limit, monthly_price_cents, stripe_price_id, description, features )"
    )
    .eq("id", profile!.company_id)
    .single();

  // Just enough for the compact teaser — the full plan list, pricing,
  // and descriptions live on the dedicated billing page now (§71/§72).
  let activeDriverCount = 0;

  if (isOwner) {
    const { count } = await supabase
      .from("drivers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");
    activeDriverCount = count ?? 0;
  }

  const currentPlan = (company?.plans as unknown as Plan | null) ?? null;

  // No cap, no .limit(1) — every teammate and every pending invite,
  // not just the first of each. A teammate's full_name can legitimately
  // be null (see the comment this used to carry, on the single-dispatcher
  // version): an invited teammate has a profile row from the moment
  // they're invited, well before they've logged in to set a name.
  let teammates: Teammate[] = [];
  let pendingInvites: PendingInvite[] = [];

  if (isOwnerOrAdmin) {
    const [{ data: teammateRows }, { data: inviteRows }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, role")
        .in("role", ["dispatcher", "admin"]),
      supabase
        .from("invites")
        .select("id, email, role")
        .in("role", ["dispatcher", "admin"])
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);
    teammates = teammateRows ?? [];
    pendingInvites = inviteRows ?? [];
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settings</h1>

      <section className="mt-8 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Company</h2>
        {company &&
          (isOwnerOrAdmin ? (
            <CompanyForm company={company} />
          ) : (
            <dl className="mt-4 max-w-md space-y-3 text-sm">
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Company name</dt>
                <dd className="text-slate-900 dark:text-slate-100">{company.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Phone</dt>
                <dd className="text-slate-900 dark:text-slate-100">{company.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-slate-500 dark:text-slate-400">Address</dt>
                <dd className="text-slate-900 dark:text-slate-100">{company.address || "—"}</dd>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-500">
                Only an owner or admin can change company details.
              </p>
            </dl>
          ))}
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">My Profile</h2>
        <ProfileForm
          userId={user.id}
          fullName={profile?.full_name ?? ""}
          email={user.email ?? ""}
          role={profile?.role ?? ""}
          theme={(profile?.theme_preference as "light" | "dark") ?? "light"}
        />
      </section>

      {isOwnerOrAdmin && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Team</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Dispatchers, admins, and drivers can all be invited from
            here. Drivers can also be added from the Drivers page
            without sending an invite right away.
          </p>

          <ul className="mt-4 space-y-1 text-sm">
            <li className="text-slate-900 dark:text-slate-100">
              {profile?.full_name ?? user.email} —{" "}
              <span className="capitalize text-slate-500 dark:text-slate-400">
                {profile?.role} (you)
              </span>
            </li>
            {teammates.map((teammate) => (
              <li key={teammate.id} className="text-slate-900 dark:text-slate-100">
                {teammate.full_name ?? "(name pending)"} —{" "}
                <span className="capitalize text-slate-500 dark:text-slate-400">
                  {teammate.role}
                </span>
              </li>
            ))}
          </ul>

          {pendingInvites.length > 0 && (
            <ul className="mt-4 space-y-2">
              {pendingInvites.map((invite) => (
                <li
                  key={invite.id}
                  className="flex items-center gap-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-400"
                >
                  <span>
                    Invite sent to <strong>{invite.email}</strong> (
                    <span className="capitalize">{invite.role}</span>) — awaiting
                    acceptance.
                  </span>
                  <CancelInviteButton inviteId={invite.id} />
                </li>
              ))}
            </ul>
          )}

          <InviteForm allowedRoles={inviteRoles} />
        </section>
      )}

      {isDispatcher && (
        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Invite a driver
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Creates the driver and sends their portal invite in one step.
            You can also add a driver from the Drivers page and invite
            them later.
          </p>

          <InviteForm allowedRoles={inviteRoles} />
        </section>
      )}

      {isOwner && currentPlan && (
        <BillingSection
          currentPlan={currentPlan}
          subscriptionStatus={company?.subscription_status ?? "trialing"}
          activeDriverCount={activeDriverCount}
        />
      )}
    </>
  );
}
