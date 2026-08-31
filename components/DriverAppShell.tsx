import Link from "next/link";

/**
 * Deliberately its own shell, not a reuse of AppShell/NavLinks — those
 * hardcode the dispatcher/owner nav (Drivers, Loads, Payroll, Settings),
 * none of which apply here. Kept simple for this foundation phase: two
 * destinations, large touch targets, no attempt yet at the fuller
 * mobile-first pass ROADMAP.md calls for once there's more to put here.
 */
export function DriverAppShell({
  companyName,
  logoUrl,
  driverName,
  children,
}: {
  companyName?: string | null;
  logoUrl?: string | null;
  driverName?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={companyName ? `${companyName} logo` : "Company logo"}
                className="h-8 w-8 rounded object-contain"
              />
            )}
            <div>
              <div className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
                {companyName ?? "Corridor Freight"}
              </div>
              {driverName && (
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {driverName}
                </div>
              )}
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Log out
            </button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-2xl gap-1 px-4 pb-3">
          <Link
            href="/driver"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            My Loads
          </Link>
          <Link
            href="/driver/profile"
            className="rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            My Profile
          </Link>
        </nav>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}
