import { NavLinks } from "./NavLinks";

/**
 * Shared header + nav for every authenticated page, now mounted once in
 * app/dashboard/layout.tsx rather than imported by each page individually.
 * `active` is accepted-but-unused — kept optional so it's a no-op for any
 * page still passing it — highlighting is now self-computed from the URL
 * by NavLinks, which is more reliable than prop-drilling the active tab
 * through every route.
 */
export function AppShell({
  companyName,
  children,
}: {
  companyName?: string | null;
  active?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-8">
            <div className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-500">
              Corridor Freight
            </div>
            <NavLinks />
          </div>
          <div className="flex items-center gap-4">
            {companyName && (
              <span className="text-sm text-slate-500 dark:text-slate-400">{companyName}</span>
            )}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
