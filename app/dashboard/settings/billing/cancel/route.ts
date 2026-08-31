import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStripeConfigured, getStripe } from "@/lib/stripe";

/**
 * Cancels the caller's company subscription. Owner-only, re-checked
 * server-side — same "the UI gate isn't the real gate" pattern as the
 * checkout route right next to this one.
 *
 * Two different real outcomes, not one button that always does the same
 * thing:
 * - "trialing": cancels the Stripe subscription immediately
 *   (subscriptions.cancel) — no charge ever happens, so there's nothing
 *   to preserve access to. Safe to reflect as canceled in the local row
 *   right away since that's genuinely what just happened.
 * - anything else with a real subscription attached ("active" or
 *   "past_due"): sets cancel_at_period_end instead — they keep access
 *   until the period they already paid for ends. Deliberately does NOT
 *   touch subscription_status here — it's still genuinely active right
 *   now, and the eventual customer.subscription.deleted webhook (fired
 *   by Stripe when the period actually ends) is what correctly flips it
 *   to canceled later, same handler already in place in
 *   app/api/stripe/webhook/route.ts.
 */
export async function POST() {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Billing isn't configured yet." },
      { status: 503 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, company_id")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "owner") {
    return NextResponse.json(
      { error: "Only the owner can manage billing." },
      { status: 403 }
    );
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, subscription_status, stripe_subscription_id")
    .eq("id", profile.company_id)
    .single();

  if (!company?.stripe_subscription_id) {
    return NextResponse.json(
      { error: "There's no active subscription to cancel." },
      { status: 400 }
    );
  }

  const stripe = getStripe();

  if (company.subscription_status === "trialing") {
    await stripe.subscriptions.cancel(company.stripe_subscription_id);

    // subscription_status is locked against normal end-user writes
    // (0009's lock_company_billing_columns trigger) — the admin client
    // is the one trusted path through it, same as the checkout route's
    // stripe_customer_id write.
    const admin = createAdminClient();
    await admin
      .from("companies")
      .update({ subscription_status: "canceled" })
      .eq("id", profile.company_id);

    return NextResponse.json({ ok: true, canceledImmediately: true });
  }

  const subscription = await stripe.subscriptions.update(
    company.stripe_subscription_id,
    { cancel_at_period_end: true }
  );

  // cancel_at is what this Stripe API version actually returns for a
  // cancel_at_period_end:true update — the concrete timestamp Stripe
  // computed from the current period, not current_period_end (that
  // moved to per-item in newer API versions, no longer top-level on the
  // subscription itself).
  return NextResponse.json({
    ok: true,
    canceledImmediately: false,
    accessUntil: subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000).toISOString()
      : null,
  });
}
