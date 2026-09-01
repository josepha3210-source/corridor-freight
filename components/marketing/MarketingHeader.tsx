import Link from "next/link";
import { CorridorLogo } from "@/components/CorridorLogo";
import { SolutionsMenu } from "./SolutionsMenu";
import { DEMO_BOOKING_URL } from "@/lib/site-config";

/**
 * Shared across every public marketing page (landing, pricing, IFTA
 * calculator) so nav/branding can't drift between them. "Request a
 * Demo" links straight to the real Cal.com booking page — same
 * prominent header position the TruckLogics reference uses for it, an
 * actual external link (not a placeholder), opened in a new tab since
 * it's a real destination the visitor should be able to come back from.
 */
export function MarketingHeader() {
  return (
    <header className="border-b border-slate-200 dark:border-slate-800">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/">
          <CorridorLogo />
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium">
          <SolutionsMenu />
          <Link
            href="/pricing"
            className="hidden text-slate-600 hover:text-slate-900 sm:inline dark:text-slate-400 dark:hover:text-slate-100"
          >
            Pricing
          </Link>
          <a
            href={DEMO_BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50 sm:inline dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Request a Demo
          </a>
          <Link
            href="/login"
            className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-md bg-brand-600 px-4 py-2 text-white transition hover:bg-brand-700"
          >
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  );
}
