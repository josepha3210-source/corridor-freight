import {
  Package,
  Users,
  Truck,
  FileText,
  FileCheck,
  Wrench,
  Folder,
  type LucideIcon,
} from "lucide-react";

export type SolutionItem = {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
};

/**
 * Corridor's own feature areas (Phase 1's sidebar IA) — the single
 * source of truth for this list, since it was previously duplicated
 * by hand in three places (the Solutions mega-menu, the footer's
 * Product column, and now the homepage's features grid). A plain
 * module, not a "use client" one, on purpose: it's imported by both a
 * client component (SolutionsMenu) and server components (the
 * homepage, the footer) — a lesson from a real bug this session (see
 * ROADMAP §97): a value exported from a "use client" file crashes when
 * a Server Component imports it, so shared data like this always lives
 * in its own plain file.
 */
export const SOLUTIONS: SolutionItem[] = [
  {
    title: "Dispatch & Loads",
    description: "Book, assign, and track every load from pickup to delivery.",
    icon: Package,
    href: "/#features",
  },
  {
    title: "Driver Management",
    description: "A driver portal with its own dashboard, signature capture, and DVIR.",
    icon: Users,
    href: "/#features",
  },
  {
    title: "Trucks & Equipment",
    description: "Registration, insurance, and inspection dates, all in one fleet view.",
    icon: Truck,
    href: "/#features",
  },
  {
    title: "Invoicing & Accounts",
    description: "Bill customers, pay drivers, and export to QuickBooks.",
    icon: FileText,
    href: "/#features",
  },
  {
    title: "IFTA Reporting",
    description: "Quarterly fuel-by-jurisdiction reports, built from real fuel purchase data.",
    icon: FileCheck,
    href: "/ifta-calculator",
  },
  {
    title: "Maintenance",
    description: "Service history per truck and FMCSA-standard driver inspections.",
    icon: Wrench,
    href: "/#features",
  },
  {
    title: "Document Management",
    description: "Licenses, insurance certs, and registrations, with expiration alerts.",
    icon: Folder,
    href: "/#features",
  },
];
