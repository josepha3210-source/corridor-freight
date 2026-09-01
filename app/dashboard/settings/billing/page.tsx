import Link from "next/link";
import { redirect } from "next/navigation";
import { requireProfile } from "@/lib/current-profile";
import { isStripeConfigured } from "@/lib/stripe";
import { STATUS_LABEL, STATUS_CLASSES, type Plan } from "@/lib/billing-format";
import { PlanCard } from "./PlanCard";
import { CancelSubscriptionButton } from "./CancelSubscriptionButton";

const PLAN_COLUMNS =
  "id, name, driver_limit, monthly_price_cents, stripe_price_id, description, features";

/**
 * Its own full page now (§71/§72) — not just a card in Settings. Owner-
 * only, re-verified independently right here rather than trusting that
 * Settings not linking here for a non-owner is enough: a direct
 * navigation to this URL has to be blocked on its own, same "the UI gate
 * isn't the real gate" reasoning as the checkout route below it.
 */
export default async function BillingPage() {
  const { supabase, profile } = await requireProfile();

  if (!profile || profile.role !== "owner") {
    redirect("/dashboard/settings");
  }

  const [{ data: company }, { data: planRows }, { count }] = await Promise.all([
    supabase
      .from("companies")
      .select(
        `subscription_status, stripe_subscription_id, plans ( ${PLAN_COLUMNS} )`
      )
      .eq("id", profile.company_id)
      .single(),
    supabase.from("plans").select(PLAN_COLUMNS).order("sort_order", { ascending: true }),
    supabase
      .from("drivers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
  ]);

  const currentPlan = (company?.plans as unknown as Plan | null) ?? null;
  const plans: Plan[] = planRows ?? [];
  const activeDriverCount = count ?? 0;
  const subscriptionStatus = company?.subscription_status ?? "trialing";
  const stripeConfigured = isStripeConfigured();
  const atLimit = currentPlan ? activeDriverCount >= currentPlan.driver_limit : false;

  return (
    <>
      <Link
        href="/dashboard/settings"
        className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
      >
        ← Back to Settings
      </Link>

      <h1 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Billing
      </h1>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-600 dark:text-slate-400">
          Current plan:{" "}
          <strong className="text-slate-900 dark:text-slate-100">
            {currentPlan?.name ?? "—"}
          </strong>
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            STATUS_CLASSES[subscriptionStatus] ??
            "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {STATUS_LABEL[subscriptionStatus] ?? subscriptionStatus}
        </span>
        {currentPlan && (
          <span
            className={`text-sm ${
              atLimit
                ? "font-medium text-red-600 dark:text-red-400"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            {activeDriverCount} of {currentPlan.driver_limit} active drivers
            used
          </span>
        )}
      </div>

      {!stripeConfigured && (
        <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-800/50 dark:text-slate-400">
          Billing isn&apos;t configured yet — plan details below are
          accurate, but upgrades aren&apos;t available through the app
          until a payment provider is connected.
        </p>
      )}

      {stripeConfigured && company?.stripe_subscription_id && (
        <div className="mt-4">
          <CancelSubscriptionButton subscriptionStatus={subscriptionStatus} />
        </div>
      )}

      {/*
        flex-wrap with a fixed per-card width, not CSS grid — a grid's
        column tracks are fixed across every row, so a 5th (or any
        non-multiple-of-the-column-count) card ends up alone in a mostly
        empty row with a large gap next to it. Flex-wrap just lets a
        trailing card sit at its natural width instead.
      */}
      <div className="mt-6 flex flex-wrap gap-6">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="w-full sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
          >
            <PlanCard
              plan={plan}
              isCurrent={plan.id === currentPlan?.id}
              stripeConfigured={stripeConfigured}
            />
          </div>
        ))}
      </div>
    </>
  );
}
