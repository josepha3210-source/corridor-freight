import Link from "next/link";
import { STATUS_LABEL, STATUS_CLASSES, type Plan } from "@/lib/billing-format";

/**
 * A compact teaser inside Settings, not the full experience — §71/§72
 * promoted Billing to its own page (/dashboard/settings/billing) with
 * real plan cards, pricing, and descriptions. This just shows the
 * essentials and links there. No interactivity left here (no upgrade
 * button, no Stripe calls), so this doesn't need to be a client
 * component anymore — that all moved to PlanCard on the full page.
 *
 * Owner-only: the caller (page.tsx) doesn't render this at all for a
 * non-owner, and the billing page itself independently re-verifies the
 * same gate rather than trusting that this one carries over.
 */
export function BillingSection({
  currentPlan,
  subscriptionStatus,
  activeDriverCount,
}: {
  currentPlan: Plan;
  subscriptionStatus: string;
  activeDriverCount: number;
}) {
  const atLimit = activeDriverCount >= currentPlan.driver_limit;

  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Billing
      </h2>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Only visible to the owner.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-base font-medium text-slate-900 dark:text-slate-100">
          {currentPlan.name} plan
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            STATUS_CLASSES[subscriptionStatus] ??
            "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {STATUS_LABEL[subscriptionStatus] ?? subscriptionStatus}
        </span>
      </div>

      <p
        className={`mt-2 text-sm ${
          atLimit
            ? "font-medium text-red-600 dark:text-red-400"
            : "text-slate-600 dark:text-slate-400"
        }`}
      >
        {activeDriverCount} of {currentPlan.driver_limit} active drivers used
        {atLimit && " — upgrade to add more"}
      </p>

      <Link
        href="/dashboard/settings/billing"
        className="mt-4 inline-block text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
      >
        Manage billing →
      </Link>
    </section>
  );
}
