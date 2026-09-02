import Link from "next/link";

export type Plan = {
  key: string;
  name: string;
  driver_limit: number;
  monthly_price_cents: number | null;
  description: string | null;
  features: string[] | null;
};

/**
 * Shared between /pricing and the homepage's pricing section — one
 * place that decides what a plan card says and where its CTA goes, so
 * the two pages can't drift into showing different copy for the same
 * plan.
 *
 * Still no dollar figures for a paid tier here (v2 prompt's own
 * instruction — see /pricing's file comment for the full reasoning);
 * Trial is the one exception, since it's genuinely free.
 *
 * A paid tier's CTA goes to /quote?plan=<key> — a few qualifying
 * questions before Cal.com, not a direct link to it (see
 * QuoteRequestForm) — so "Get a Quote" is a real lead-qualification
 * step, not just an unqualified booking link.
 */
export function PlanCard({
  plan,
  highlight = false,
  showFeatures = false,
}: {
  plan: Plan;
  highlight?: boolean;
  showFeatures?: boolean;
}) {
  const isFree = plan.monthly_price_cents === 0;
  const isCustom = plan.key === "custom";
  const driverLimitLabel =
    plan.driver_limit >= 9999 ? "Unlimited drivers" : `Up to ${plan.driver_limit} drivers`;

  return (
    <div
      className={`flex flex-col rounded-xl border p-6 ${
        highlight
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
        <Link
          href={`/quote?plan=${plan.key}`}
          className="mt-4 rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {isCustom ? "Talk to us" : "Get a Quote"}
        </Link>
      )}

      {showFeatures && plan.features && plan.features.length > 0 && (
        <ul className="mt-5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
          {plan.features.slice(0, 4).map((feature) => (
            <li key={feature}>• {feature}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
