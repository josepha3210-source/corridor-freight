import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ThemeSync } from "@/components/ThemeSync";
import { TimezoneSync } from "@/components/TimezoneSync";
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
  const { companyName, profile } = await requireProfile();

  if (profile?.role === "driver") {
    redirect("/driver");
  }

  return (
    <AppShell companyName={companyName}>
      <ThemeSync
        theme={(profile?.theme_preference as "light" | "dark") ?? "light"}
      />
      <TimezoneSync />
      {children}
    </AppShell>
  );
}
