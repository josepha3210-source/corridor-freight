"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/dashboard/drivers", label: "Drivers" },
  { href: "/dashboard/loads", label: "Loads" },
  { href: "/dashboard/payroll", label: "Payroll" },
  { href: "/dashboard/settings", label: "Settings" },
] as const;

/**
 * Split out of AppShell as a client component so the shell itself can
 * stay server-rendered — usePathname is the only reason this piece needs
 * the client boundary. "/dashboard" would otherwise match every route as
 * a startsWith prefix, so it's the one item checked for an exact match.
 */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : pathname?.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              isActive
                ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
