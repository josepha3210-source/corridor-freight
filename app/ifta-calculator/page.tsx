import type { Metadata } from "next";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { IftaCalculatorForm } from "./IftaCalculatorForm";

export const metadata: Metadata = {
  title: "Free IFTA Calculator",
  description: "Estimate your quarterly IFTA fuel tax liability by jurisdiction — a free tool from Corridor Freight.",
};

/**
 * Public IFTA Calculator (v2 prompt's Phase 6) — a real lead-gen tool,
 * not a demo. Uses the actual IFTA net-taxable-gallons formula; see
 * IftaCalculatorForm's own comment for what's real math vs. an
 * editable example rate.
 */
export default function IftaCalculatorPage() {
  return (
    <div className="bg-white dark:bg-slate-950">
      <MarketingHeader />

      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-4xl">
            Free IFTA Calculator
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-base text-slate-600 dark:text-slate-400">
            Estimate what you owe (or get credited) per jurisdiction
            this quarter, based on miles driven and fuel purchased.
          </p>
        </div>

        <div className="mt-10">
          <IftaCalculatorForm />
        </div>

        <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
          Corridor Freight tracks fuel purchases and generates this same
          report automatically once you're a customer — see it on the{" "}
          <a href="/pricing" className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
            pricing page
          </a>
          .
        </p>
      </main>

      <MarketingFooter />
    </div>
  );
}
