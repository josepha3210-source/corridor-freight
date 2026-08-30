import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStripeConfigured, getStripe } from "@/lib/stripe";

/**
 * Creates a Stripe Checkout session for the caller's company to move
 * onto a paid plan. Owner-only — billing is exactly the boundary §66
 * carved out between owner and admin, and this re-checks it server-side
 * rather than trusting the Billing section only being shown to an owner
 * in the UI, same reasoning as every other route in this app.
 *
 * Degrades cleanly with no Stripe account configured (§70) — returns a
 * plain "not configured" error rather than throwing, so the Billing UI
 * can show a placeholder instead of a broken button.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Billing isn't configured yet. Contact support to upgrade." },
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

  const body = await request.json().catch(() => null);
  const planId = typeof body?.planId === "string" ? body.planId : "";

  if (!planId) {
    return NextResponse.json({ error: "planId is required." }, { status: 400 });
  }

  const { data: plan } = await supabase
    .from("plans")
    .select("id, name, stripe_price_id")
    .eq("id", planId)
    .single();

  if (!plan) {
    return NextResponse.json({ error: "Plan not found." }, { status: 404 });
  }
  if (!plan.stripe_price_id) {
    return NextResponse.json(
      { error: `The ${plan.name} plan isn't available for checkout yet.` },
      { status: 400 }
    );
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id, stripe_customer_id")
    .eq("id", profile.company_id)
    .single();

  if (!company) {
    return NextResponse.json({ error: "Company not found." }, { status: 404 });
  }

  const stripe = getStripe();
  const origin = new URL(request.url).origin;

  // stripe_customer_id is locked against normal end-user writes (0009's
  // lock_company_billing_columns trigger) — this is the one narrow,
  // trusted write allowed through, and it only ever happens once per
  // company, the first time they start a checkout.
  let customerId = company.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { company_id: profile.company_id },
    });
    customerId = customer.id;

    const admin = createAdminClient();
    await admin
      .from("companies")
      .update({ stripe_customer_id: customerId })
      .eq("id", profile.company_id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    success_url: `${origin}/dashboard/settings?billing=success`,
    cancel_url: `${origin}/dashboard/settings?billing=cancelled`,
    metadata: { company_id: profile.company_id, plan_id: plan.id },
  });

  if (!session.url) {
    return NextResponse.json(
      { error: "Stripe didn't return a checkout URL." },
      { status: 502 }
    );
  }

  return NextResponse.json({ url: session.url });
}
