import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { DEMO_BOOKING_URL } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Driver-based pricing for Corridor Freight — Trial, Starter, Growth, and Fleet.",
};

type Plan = {
  key: string;
  name: string;
  driver_limit: number;
  monthly_price_cents: number | null;
  description: string | null;
  features: string[] | null;
};

/**
 * Real public pricing page (v2 prompt's Phase 6). "Get a Quote," not a
 * listed price, for every paid tier — deliberately not publishing
 * dollar amounts here, per the prompt's own instruction. Trial is the
 * one exception: it's genuinely free, so it says "Free" plainly rather
 * than routing a $0 plan through a quote request.
 *
 * This is a public-marketing-page decision only — Settings → Billing
 * (a logged-in owner about to actually pay through Stripe Checkout)
 * keeps showing real prices, a transactional context where the number
 * has to be visible before checkout, not a marketing one.
 *
 * Tier names, driver limits, and feature lists all come from the real
 * `plans` table (0029 opened read access to logged-out visitors) so
 * this page's copy can't drift from what's actually offered — only
 * `monthly_price_cents` is deliberately never rendered here for a paid
 * tier.
 */
export default async function PricingPage() {
  const supabase = createClient();
  const { data: plansData } = await supabase
    .from("plans")
    .select("key, name, driver_limit, monthly_price_cents, description, features")
    .order("sort_order");

  const plans = (plansData ?? []) as unknown as Plan[];

  // Every distinct feature line across every plan, in first-seen order
  // — this is what makes the comparison table below genuinely data-
  // driven (checked against what a plan's own features array actually
  // lists) rather than a hand-maintained grid that can silently drift
  // from the real plan data.
  const allFeatures: string[] = [];
  for (const plan of plans) {
    for (const feature of plan.features ?? []) {
      if (!allFeatures.includes(feature)) allFeatures.push(feature);
    }
  }

  return (
    <div className="bg-white dark:bg-slate-950">
      <MarketingHeader />

      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            Pricing that scales with your fleet
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-slate-600 dark:text-slate-400">
            Driver-based tiers, not truck-count. No per-mile fees or
            surprise add-ons.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {plans.map((plan) => (
            <PlanCard key={plan.key} plan={plan} />
          ))}
        </div>

        {allFeatures.length > 0 && (
          <div className="mt-20">
            <h2 className="text-center text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Compare features
            </h2>
            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 pr-4 font-medium text-slate-500 dark:text-slate-400">
                      Feature
                    </th>
                    {plans.map((plan) => (
                      <th
                        key={plan.key}
                        className="px-4 py-3 text-center font-medium text-slate-900 dark:text-slate-100"
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allFeatures.map((feature) => (
                    <tr key={feature} className="border-b border-slate-100 dark:border-slate-900">
                      <td className="py-3 pr-4 text-slate-700 dark:text-slate-300">{feature}</td>
                      {plans.map((plan) => (
                        <td key={plan.key} className="px-4 py-3 text-center">
                          {(plan.features ?? []).includes(feature) ? (
                            <Check className="mx-auto h-4 w-4 text-brand-600 dark:text-brand-400" />
                          ) : (
                            <span className="text-slate-300 dark:text-slate-700">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="mt-16 text-center">
          <a
            href={DEMO_BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Request a Demo
          </a>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}

function PlanCard({ plan }: { plan: Plan }) {
  const isFree = plan.monthly_price_cents === 0;
  const isCustom = plan.key === "custom";
  const driverLimitLabel =
    plan.driver_limit >= 9999 ? "Unlimited drivers" : `Up to ${plan.driver_limit} drivers`;

  return (
    <div
      className={`flex flex-col rounded-xl border p-6 ${
        plan.key === "growth"
          ? "border-brand-500 ring-1 ring-brand-500"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{plan.name}</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{driverLimitLabel}</p>
      {plan.description && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">{plan.description}</p>
      )}

      <p className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {isFree ? "Free" : "Get a Quote"}
      </p>

      {isFree ? (
        <Link
          href="/signup"
          className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-center text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Start free trial
        </Link>
      ) : (
        <a
          href={DEMO_BOOKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {isCustom ? "Talk to us" : "Get a Quote"}
        </a>
      )}
    </div>
  );
}
