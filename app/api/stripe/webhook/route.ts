import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStripeConfigured, getStripe } from "@/lib/stripe";

type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled";

/**
 * Stripe calls this directly — no browser session, no cookies, so it has
 * to be excluded from the auth gate in lib/supabase/middleware.ts or
 * every delivery attempt gets 307'd to /login before it ever reaches
 * here. Uses the admin client throughout: this is the one place company
 * billing state is actually allowed to change (see 0009's
 * lock_company_billing_columns trigger, which locks those columns
 * against every request that *does* carry a user session).
 *
 * Degrades cleanly with no Stripe account configured (§70) — a 503
 * rather than a crash, since this route can be deployed and reachable
 * long before real keys exist.
 */
export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!isStripeConfigured() || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe is not configured." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  const rawBody = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    // Checkout completed — this is when we first learn which plan and
    // which company this subscription belongs to (both passed through
    // as metadata when the checkout route created the session).
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.company_id;
      const planId = session.metadata?.plan_id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (companyId) {
        // Not a hardcoded "active" — a checkout with a trial attached
        // (§73's 3-day card-required trial) completes with the
        // subscription still in "trialing", not "active", and writing
        // "active" here would be simply wrong for that entire signup
        // funnel. Fetching the real subscription is the only way to
        // know which one it actually is.
        let subscriptionStatus: SubscriptionStatus = "active";
        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          subscriptionStatus = mapStripeStatus(subscription.status);
        }

        const pastDueUpdate = await buildPastDueUpdate(
          admin,
          companyId,
          subscriptionStatus
        );

        await admin
          .from("companies")
          .update({
            subscription_status: subscriptionStatus,
            ...pastDueUpdate,
            ...(planId ? { plan_id: planId } : {}),
            ...(subscriptionId ? { stripe_subscription_id: subscriptionId } : {}),
          })
          .eq("id", companyId);
      }
      break;
    }

    // Ongoing subscription lifecycle — matched by subscription id, not
    // metadata, since these events don't carry the original checkout
    // session's metadata.
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const newStatus = mapStripeStatus(subscription.status);

      // Looked up by stripe_subscription_id, not a company_id from the
      // payload (this event doesn't carry one) — need the row's own id
      // to both read its current state and write the update back to it.
      const { data: company } = await admin
        .from("companies")
        .select("id, subscription_status, past_due_since")
        .eq("stripe_subscription_id", subscription.id)
        .single();

      if (company) {
        const pastDueUpdate = pastDueUpdateFrom(company, newStatus);
        await admin
          .from("companies")
          .update({ subscription_status: newStatus, ...pastDueUpdate })
          .eq("id", company.id);
      }
      break;
    }

    default:
      // Not every Stripe event needs a handler — anything unrecognized
      // is acknowledged and ignored rather than treated as an error.
      break;
  }

  return NextResponse.json({ received: true });
}

function mapStripeStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "canceled":
      return "canceled";
    // unpaid/incomplete/incomplete_expired/paused all mean "not
    // currently paying and not cleanly cancelled either" — closest fit
    // in this app's four-state model is past_due, not a fifth status.
    default:
      return "past_due";
  }
}

/**
 * Computes what `past_due_since` should become given a company's
 * current state and its new status — never overwritten blindly.
 * Entering `past_due` for the first time stamps "now"; staying
 * `past_due` across repeated webhook pings leaves the original
 * timestamp alone (the grace-period clock must not keep resetting);
 * moving to any other status clears it. This is the one thing that
 * makes the grace period (lib/past-due.ts,
 * enforce_payment_write_lock in 0014) mean anything at all — without
 * it, "how long has this been past_due" has no answer.
 */
function pastDueUpdateFrom(
  current: { subscription_status: string; past_due_since: string | null },
  newStatus: SubscriptionStatus
): { past_due_since: string | null } {
  if (newStatus !== "past_due") {
    return { past_due_since: null };
  }
  if (current.subscription_status === "past_due" && current.past_due_since) {
    return { past_due_since: current.past_due_since };
  }
  return { past_due_since: new Date().toISOString() };
}

async function buildPastDueUpdate(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  newStatus: SubscriptionStatus
): Promise<{ past_due_since: string | null }> {
  const { data: current } = await admin
    .from("companies")
    .select("subscription_status, past_due_since")
    .eq("id", companyId)
    .single();

  return pastDueUpdateFrom(
    current ?? { subscription_status: "trialing", past_due_since: null },
    newStatus
  );
}
