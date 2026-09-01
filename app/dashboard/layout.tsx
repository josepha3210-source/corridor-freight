import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ThemeSync } from "@/components/ThemeSync";
import { TimezoneSync } from "@/components/TimezoneSync";
import { PastDueBanner } from "@/components/PastDueBanner";
import { requireProfile } from "@/lib/current-profile";

/**
 * Mounts the nav shell once for every /dashboard/* route instead of each
 * page importing AppShell itself. requireProfile() also runs here to
 * enforce the login redirect at the layout level — a signed-out user
 * bounces to /login before any child page's own data-fetching runs.
 *
 * A driver landing here gets bounced to their own portal — this
 * dashboard's nav/pages (Drivers, Payroll, Settings) aren't meaningful
 * for that role, and RLS would just show them empty tables anyway, so
 * routing them correctly avoids a confusing half-broken screen. This is
 * a UX redirect, not the security boundary — that's the RLS policies in
 * migration 0006.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, companyName, logoUrl, profile } = await requireProfile();

  if (profile?.role === "driver") {
    redirect("/driver");
  }

  // Deliberately its own isolated query, not folded into requireProfile()
  // — that shared helper backs nearly every page in this app, and a
  // single bad/missing column anywhere in one combined query fails the
  // whole thing (this is exactly how the logo lookup broke every
  // /dashboard/* page before it was split out the same way — see
  // lib/current-profile.ts). A failure here should only ever mean "no
  // banner," never "no profile."
  //
  // Owner-only, per the spec this banner implements — an admin or
  // dispatcher can't act on it anyway (billing is owner-only, §66), so
  // showing it to them would just be an alarming banner with no button
  // that does anything for them.
  let pastDueSince: string | null = null;
  if (profile?.role === "owner" && profile.company_id) {
    const { data: billingState } = await supabase
      .from("companies")
      .select("subscription_status, past_due_since")
      .eq("id", profile.company_id)
      .single();

    if (
      billingState?.subscription_status === "past_due" &&
      billingState.past_due_since
    ) {
      pastDueSince = billingState.past_due_since;
    }
  }

  return (
    <>
      {pastDueSince && <PastDueBanner pastDueSince={pastDueSince} />}
      <AppShell companyName={companyName} logoUrl={logoUrl}>
        <ThemeSync
          theme={(profile?.theme_preference as "light" | "dark") ?? "light"}
        />
        <TimezoneSync />
        {children}
      </AppShell>
    </>
  );
}
