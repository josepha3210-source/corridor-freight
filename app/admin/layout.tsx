import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { createClient } from "@/lib/supabase/server";
import { ThemeSync } from "@/components/ThemeSync";

/**
 * Platform-admin shell (ROADMAP §101). Top-level `/admin`, a sibling of
 * `/dashboard` — deliberately NOT nested under it, so it inherits none
 * of the tenant dashboard's layout, nav, or company-scoped
 * data-fetching (`requireProfile`, `current_company_id()`). The only
 * thing it shares with the rest of the app is the visual language.
 *
 * `force-dynamic`: every /admin page is live, per-request, cross-tenant
 * data and must never be statically cached or prerendered. Set here and
 * on each page.
 *
 * The admin check also runs in `requirePlatformAdmin()` at the top of
 * every page — this call in the layout is a second layer, not the only
 * one (a shared layout guard alone wouldn't cover someone deep-linking
 * straight to a sub-page in every rendering path).
 */
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/companies", label: "Companies" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requirePlatformAdmin();

  // Best-effort: respect the operator's own stored light/dark preference
  // if they happen to also have a tenant profile. RLS scopes this to
  // their own row; no match (a pure platform operator with no company)
  // just falls back to light.
  const supabase = createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("theme_preference")
    .eq("id", user.id)
    .maybeSingle();
  const theme = (profile?.theme_preference as "light" | "dark") ?? "light";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-brand-950">
      <ThemeSync theme={theme} />
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Corridor{" "}
            <span className="font-normal text-slate-400 dark:text-slate-500">
              · Platform Admin
            </span>
          </span>
          <nav className="flex gap-4 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-slate-600 hover:text-brand-700 dark:text-slate-400 dark:hover:text-brand-400"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="hidden text-slate-500 dark:text-slate-400 sm:inline">
              {user.email}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Log out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        {children}
      </main>
    </div>
  );
}
