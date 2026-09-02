import type { Metadata } from "next";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { DEMO_BOOKING_URL } from "@/lib/site-config";
import { PlanCard, type Plan } from "@/components/marketing/PlanCard";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Driver-based pricing for Corridor Freight — Trial, Starter, Growth, and Fleet.",
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
            <PlanCard key={plan.key} plan={plan} highlight={plan.key === "growth"} />
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
