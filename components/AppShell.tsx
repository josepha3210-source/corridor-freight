"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { CorridorLogo } from "./CorridorLogo";

/**
 * Phase 1's IA rebuild — a grouped sidebar (Sidebar.tsx) replaces the
 * old flat horizontal nav. This is a client component now (it wasn't
 * before) purely to own the mobile drawer's open/closed state, shared
 * between the header's hamburger button and the sidebar itself; `children`
 * — every /dashboard/* page, all server components — still renders fully
 * server-side despite passing through this client boundary, a
 * standard, supported Next.js pattern, not something that pushes the
 * dashboard pages themselves to the client.
 */
export function AppShell({
  companyName,
  logoUrl,
  children,
}: {
  companyName?: string | null;
  logoUrl?: string | null;
  active?: string;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-brand-950">
      <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 transition-colors dark:border-brand-800 dark:bg-brand-900 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5 sm:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <CorridorLogo />
          </div>
          <div className="flex items-center gap-4">
            {logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={companyName ? `${companyName} logo` : "Company logo"}
                className="h-8 w-8 rounded object-contain"
              />
            )}
            {companyName && (
              <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">
                {companyName}
              </span>
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
        </header>

        <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10">
          <div className="mx-auto max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
