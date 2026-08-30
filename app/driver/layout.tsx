import { DriverAppShell } from "@/components/DriverAppShell";
import { ThemeSync } from "@/components/ThemeSync";
import { TimezoneSync } from "@/components/TimezoneSync";
import { requireDriver } from "@/lib/current-driver";

export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { companyName, profile, driver } = await requireDriver();

  return (
    <DriverAppShell companyName={companyName} driverName={driver?.full_name}>
      <ThemeSync
        theme={(profile?.theme_preference as "light" | "dark") ?? "light"}
      />
      <TimezoneSync />
      {driver ? (
        children
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          Your login isn&apos;t linked to a driver record yet — ask your
          dispatcher to check your invite.
        </div>
      )}
    </DriverAppShell>
  );
}
