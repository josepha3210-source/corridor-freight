/**
 * Shared between the Settings billing teaser and the full billing page
 * (§71/§72) — one definition of what a plan looks like and how its
 * price/status render, rather than three slightly-drifting copies.
 */
export type Plan = {
  id: string;
  name: string;
  driver_limit: number;
  monthly_price_cents: number | null;
  stripe_price_id: string | null;
  description: string | null;
  features: string[];
};

export const STATUS_LABEL: Record<string, string> = {
  trialing: "Trialing",
  active: "Active",
  past_due: "Past due",
  canceled: "Canceled",
};

export const STATUS_CLASSES: Record<string, string> = {
  trialing:
    "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400",
  active:
    "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  past_due: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
  canceled:
    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function formatPrice(cents: number | null): string {
  if (cents === null) return "Contact support for pricing";
  if (cents === 0) return "Free";
  return `$${(cents / 100).toLocaleString()}/mo`;
}
