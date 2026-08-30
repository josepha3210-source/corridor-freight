import Stripe from "stripe";

/**
 * No real Stripe account exists yet (ROADMAP.md §70) — every caller must
 * check this before doing anything Stripe-related, and degrade to a
 * plain "billing isn't configured yet" message rather than erroring.
 */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let cached: Stripe | null = null;

/**
 * Constructed lazily inside the call site that needs it, same reasoning
 * as lib/supabase/admin.ts's createAdminClient() — a missing key surfaces
 * as a clear error from that one call, not a crash on server boot. Always
 * check isStripeConfigured() first; this throw is a backstop, not the
 * primary gate.
 */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set — check isStripeConfigured() before calling getStripe()."
    );
  }
  if (!cached) {
    cached = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return cached;
}
