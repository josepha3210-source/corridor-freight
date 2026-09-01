"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ClipboardList,
  Route,
  Users,
  Truck,
  Wrench,
  FileText,
  DollarSign,
  Fuel,
  FileCheck,
  Receipt,
  Folder,
  Building2,
  BookUser,
  Settings,
  BarChart3,
  X,
  type LucideIcon,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; items: NavItem[] };

/**
 * Replaces the old flat top-bar nav (formerly NavLinks.tsx) — Phase 1's
 * IA rebuild groups everything the way TruckLogics does (Dispatches/
 * Loads/Accounts/Truck Zone/IFTA/Reports as distinct areas), not one
 * long list. Most of these routes are placeholder pages today — see
 * ROADMAP.md §78 for which ones — the full structure is built now so
 * later phases just fill in real pages behind links that already exist,
 * rather than growing the nav one item at a time.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/dashboard/loads", label: "Loads", icon: Package },
      { href: "/dashboard/dispatches", label: "Dispatches", icon: Route },
      { href: "/dashboard/load-board", label: "Load Board", icon: ClipboardList },
    ],
  },
  {
    label: "Fleet",
    items: [
      { href: "/dashboard/drivers", label: "Drivers", icon: Users },
      { href: "/dashboard/trucks", label: "Trucks & Equipment", icon: Truck },
      { href: "/dashboard/maintenance", label: "Maintenance", icon: Wrench },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/dashboard/invoicing", label: "Invoicing", icon: FileText },
      { href: "/dashboard/payroll", label: "Settlements", icon: DollarSign },
      { href: "/dashboard/fuel", label: "Fuel", icon: Fuel },
    ],
  },
  {
    label: "Compliance",
    items: [
      { href: "/dashboard/ifta", label: "IFTA", icon: FileCheck },
      { href: "/dashboard/hvut", label: "HVUT 2290", icon: Receipt },
      { href: "/dashboard/documents", label: "Documents", icon: Folder },
    ],
  },
  {
    label: "Contacts",
    items: [
      { href: "/dashboard/customers", label: "Customers", icon: Building2 },
      { href: "/dashboard/address-book", label: "Address Book", icon: BookUser },
    ],
  },
  {
    label: "Company",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
      { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
    ],
  },
];

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(href);

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {group.label}
          </p>
          <div className="mt-1 space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/**
 * Presentational only — the open/close state lives in AppShell, which
 * also owns the header's hamburger button, so one piece of state drives
 * both. Desktop: a static column, always visible. Mobile: an off-canvas
 * drawer, since a persistent 240px column doesn't fit a phone screen the
 * way the old horizontal nav bar used to.
 */
export function Sidebar({
  mobileOpen,
  onClose,
}: {
  mobileOpen: boolean;
  onClose: () => void;
}) {
  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-slate-200 bg-white dark:border-brand-800 dark:bg-brand-900">
            <div className="flex items-center justify-end px-3 py-3">
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation"
                className="rounded-md p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavContent onNavigate={onClose} />
          </div>
        </div>
      )}

      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-brand-800 dark:bg-brand-900 sm:flex">
        <NavContent />
      </aside>
    </>
  );
}
