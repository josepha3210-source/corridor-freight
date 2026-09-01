import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

/**
 * Public marketing page for logged-out visitors. A logged-in user never
 * sees any of the JSX below — this redirects them straight to
 * /dashboard before rendering anything, same as before this page had
 * marketing content at all (the dashboard layout further redirects a
 * driver-role user on to /driver from there, unchanged).
 *
 * Reaching this branch at all requires lib/supabase/middleware.ts's
 * auth gate to actually let an unauthenticated request through to "/"
 * — it didn't before this page had content, since middleware bounced
 * every logged-out request to /login ahead of any page component ever
 * running.
 */
export default async function Home() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="bg-white dark:bg-slate-950">
      <MarketingHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl">
            Run your trucking company from one place.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
            Corridor Freight is dispatch software built for small and
            midsize trucking carriers — loads, drivers, payments, and a
            driver portal, without the spreadsheets and text threads.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              Start free trial
            </Link>
            <Link
              href="/login"
              className="rounded-md border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              Log in
            </Link>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
              <Feature
                title="Dispatch & loads"
                description="Track every load from pickup to delivery, assign drivers, and keep client rate and driver pay straight in one dashboard."
              />
              <Feature
                title="Driver portal"
                description="Drivers get their own mobile-friendly login — assigned loads, status updates, and delivery confirmation, no phone calls or texts needed."
              />
              <Feature
                title="Signature at delivery"
                description="Capture a real signature at the point of delivery, stored with the load, as your own proof-of-delivery record."
              />
              <Feature
                title="Role-based access"
                description="Owners, admins, dispatchers, and drivers each see exactly what their role needs — nothing more, nothing less."
              />
            </div>
          </div>
        </section>

        {/* Pricing teaser — no dollar figures here; the real numbers
            live on the dedicated /pricing page, and paid tiers there
            route to a quote request, not a published price (deliberate
            v2-prompt decision — see /pricing for the reasoning). */}
        <section className="mx-auto max-w-6xl px-6 py-16 text-center">
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Driver-based pricing, not truck-count
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600 dark:text-slate-400">
            Trial, Starter, Growth, and Fleet tiers, scaled to how many
            drivers you run.
          </p>
          <div className="mt-6">
            <Link
              href="/pricing"
              className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              See plans and features →
            </Link>
          </div>
        </section>

        {/* Final CTA */}
        <section className="border-t border-slate-200 dark:border-slate-800">
          <div className="mx-auto max-w-6xl px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Ready to get your operation off spreadsheets?
            </h2>
            <div className="mt-6">
              <Link
                href="/signup"
                className="rounded-md bg-brand-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
              >
                Start free trial
              </Link>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}

function Feature({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        {description}
      </p>
    </div>
  );
}

