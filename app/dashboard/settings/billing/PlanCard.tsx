"use client";

import { useState } from "react";
import { formatPrice, type Plan } from "@/lib/billing-format";

/**
 * The description/feature list expands regardless of Stripe being
 * configured — it's purely informational (§71/§72's "clicking a plan
 * should always show its details"). Only the Upgrade button itself is
 * gated on stripeConfigured && plan.stripe_price_id, same rule the old
 * compact BillingSection card used, just not touched here.
 */
export function PlanCard({
  plan,
  isCurrent,
  stripeConfigured,
}: {
  plan: Plan;
  isCurrent: boolean;
  stripeConfigured: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCheckout = stripeConfigured && Boolean(plan.stripe_price_id);

  async function handleUpgrade() {
    setError(null);
    setLoading(true);

    const res = await fetch("/dashboard/settings/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoading(false);
      setError(body.error ?? "Something went wrong starting checkout.");
      return;
    }

    window.location.href = body.url;
  }

  return (
    <div
      className={`flex flex-col rounded-xl border bg-white p-6 dark:bg-slate-900 ${
        isCurrent
          ? "border-brand-500 ring-1 ring-brand-500"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      {isCurrent && (
        <span className="mb-2 inline-block w-fit rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
          Current plan
        </span>
      )}

      <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        {plan.name}
      </h3>
      <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {formatPrice(plan.monthly_price_cents)}
      </p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Up to {plan.driver_limit} drivers
      </p>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-3 text-left text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
      >
        {expanded ? "Hide details" : "See what's included"}
      </button>

      {expanded && (
        <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          {plan.description && (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {plan.description}
            </p>
          )}
          {plan.features.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-slate-700 dark:text-slate-300">
              {plan.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span aria-hidden="true">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-4 flex-1" />

      {isCurrent ? (
        <span className="block rounded-md bg-slate-100 px-3 py-2 text-center text-sm font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          Your current plan
        </span>
      ) : canCheckout ? (
        <button
          onClick={handleUpgrade}
          disabled={loading}
          className="w-full rounded-md bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Redirecting…" : "Upgrade"}
        </button>
      ) : (
        <span className="block rounded-md border border-slate-200 px-3 py-2 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-500">
          Contact support to upgrade
        </span>
      )}

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
