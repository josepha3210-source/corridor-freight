import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { QuoteRequestForm } from "@/components/marketing/QuoteRequestForm";

export const metadata: Metadata = {
  title: "Get a Quote",
  description: "Tell us about your fleet and book a time to talk through pricing.",
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  fleet: "Fleet",
  custom: "Custom / Enterprise",
};

/**
 * Public quote-request page (v2 prompt: "when people want to sign up
 * or get a quote, they have to answer some questions"). Reached from
 * a Pricing plan card's "Get a Quote" / "Talk to us" button, which
 * used to link straight to Cal.com with zero context attached — this
 * puts a few real qualifying questions in between (QuoteRequestForm)
 * so Joseph walks into the actual call already knowing the prospect's
 * fleet size and what they're replacing.
 *
 * `?plan=` is display-only context (which card the visitor clicked
 * from) — not a redirect target or a gate, since a visitor can and
 * should still be able to reach this page directly.
 */
export default function QuotePage({
  searchParams,
}: {
  searchParams: { plan?: string };
}) {
  const planKey = searchParams.plan ?? null;
  const planLabel = planKey ? PLAN_LABELS[planKey] ?? null : null;

  return (
    <div className="bg-white dark:bg-slate-950">
      <MarketingHeader />

      <main className="mx-auto max-w-2xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {planLabel ? `Get a quote for ${planLabel}` : "Get a quote"}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm text-slate-600 dark:text-slate-400">
            A few quick questions, then pick a time that works — no
            obligation, no pressure.
          </p>
        </div>

        <div className="mt-10">
          <QuoteRequestForm planInterest={planKey} />
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
