import { redirect } from "next/navigation";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { PlanCard, type Plan } from "@/components/marketing/PlanCard";
import { SOLUTIONS } from "@/lib/marketing-solutions";
import { DEMO_BOOKING_URL } from "@/lib/site-config";

/**
 * Public marketing page for logged-out visitors. A logged-in user never
 * sees any of the JSX below — this redirects them straight to
 * /dashboard before rendering anything, same as before this page had
 * marketing content at all (the dashboard layout further redirects a
 * driver-role user on to /driver from there, unchanged).
 *
 * Reaching this branch at all requires lib/supabase/middleware.ts's
 * auth gate to actually let an unauthenticated request through to "/"
 * — it didn't before this page had content, since middleware bounced
 * every logged-out request to /login ahead of any page component ever
 * running.
 *
 * Full redesign (asked for directly, comparing against a reference
 * competitor site): richer hero with an illustrative dashboard preview
 * (clearly labeled as sample data, not a real customer's numbers —
 * this app doesn't fabricate data anywhere else and shouldn't start
 * here), the real Solutions list reused as an icon grid instead of a
 * bare 4-item feature strip, and the actual 5-tier plan set (pulled
 * live from `plans`, same query /pricing uses) shown directly on the
 * homepage instead of a text link out to it. No fabricated customer
 * logos, review scores, or usage-count claims anywhere on this page —
 * there are no real customers yet, and inventing social proof would
 * be exactly the kind of dishonesty this whole build has avoided
 * everywhere else (the IFTA calculator's labeled-example rates, the
 * HVUT stub, etc).
 */
export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const { data: plansData } = await supabase
    .from("plans")
    .select("key, name, driver_limit, monthly_price_cents, description, features")
    .order("sort_order");
  const plans = (plansData ?? []) as unknown as Plan[];

  return (
    <div className="bg-white dark:bg-slate-950">
      <MarketingHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <div className="grid items-start gap-12 lg:grid-cols-2">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
                Run your trucking company from one place.
              </h1>
              <p className="mt-4 max-w-xl text-lg text-slate-600 dark:text-slate-400">
                Corridor Freight is dispatch software built for small and
                midsize trucking carriers — loads, drivers, payments, and a
                driver portal, without the spreadsheets and text threads.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/signup"
                  className="rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  Start free trial
                </Link>
                <a
                  href={DEMO_BOOKING_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                >
                  Book a demo
                </a>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
                <li className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  3-day free trial, card required
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  Driver-based pricing, no per-mile fees
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                  No setup fees
                </li>
              </ul>
            </div>

            <DashboardPreview />
          </div>
        </section>

        {/* What's new */}
        <div className="border-y border-slate-200 bg-brand-50/60 dark:border-slate-800 dark:bg-brand-500/5">
          <p className="mx-auto max-w-6xl px-6 py-3 text-center text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold text-brand-700 dark:text-brand-400">What&apos;s new:</span>{" "}
            customer-facing tracking links, lane profitability reports, and
            driver scorecards.{" "}
            <a
              href="#features"
              className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-400"
            >
              See what&apos;s included
            </a>
          </p>
        </div>

        {/* Solutions grid */}
        <section id="features" className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="text-center">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 sm:text-3xl">
                An all-in-one trucking management solution
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
                Everything a small or midsize fleet needs, built as one
                connected system instead of a pile of spreadsheets.
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {SOLUTIONS.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-slate-900 dark:text-slate-100">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing — real plans, pulled live from the same table /pricing
            reads, so this section can't drift from what's actually on
            offer. No dollar figures for a paid tier (see PlanCard). */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 sm:text-3xl">
              Simple, driver-based pricing
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-400">
              No per-mile fees or surprise add-ons. Start on a 3-day free
              trial, then pick the tier that matches your fleet — or talk
              to us about something custom.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {plans.map((plan) => (
              <PlanCard key={plan.key} plan={plan} highlight={plan.key === "growth"} />
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Compare full feature list
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-slate-200 dark:border-slate-800">
          <div className="mx-auto max-w-6xl px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Ready to get your operation off spreadsheets?
            </h2>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/signup"
                className="rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Start free trial
              </Link>
              <a
                href={DEMO_BOOKING_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
              >
                Book a demo
              </a>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

/**
 * An illustrative preview of the real dashboard — not a screenshot,
 * and explicitly labeled "Sample data" rather than implying these are
 * a real customer's numbers. Built from the actual stat tiles/labels
 * the real /dashboard shows (Loads in progress, Revenue MTD, On-time
 * delivery, Fleet utilization), so a visitor who signs up sees a
 * genuinely familiar layout, not a mockup that oversells something
 * different from the real product.
 */
function DashboardPreview() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-1.5 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        <span className="h-2.5 w-2.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        <span className="ml-2 text-xs font-medium text-slate-400 dark:text-slate-600">
          Rowan Trucking LLC
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 p-5">
        <PreviewTile label="Loads in progress" value="12" />
        <PreviewTile label="Revenue MTD" value="$48,200" />
        <PreviewTile label="On-time delivery" value="96%" />
        <PreviewTile label="Fleet utilization" value="88%" />
      </div>

      <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-600">
          Needs attention soon
        </p>
        <div className="mt-2 space-y-2">
          <PreviewRow label="L-0042 — Denver, CO → Boulder, CO" tag="Pickup today" />
          <PreviewRow label="Truck #14 — registration" tag="Due in 12 days" />
        </div>
      </div>

      <p className="border-t border-slate-100 px-5 py-2.5 text-center text-[11px] text-slate-400 dark:border-slate-800 dark:text-slate-600">
        Sample data — your dashboard, your numbers.
      </p>
    </div>
  );
}

function PreviewTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function PreviewRow({ label, tag }: { label: string; tag: string }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-xs dark:bg-slate-800">
      <span className="text-slate-700 dark:text-slate-300">{label}</span>
      <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
        {tag}
      </span>
    </div>
  );
}
