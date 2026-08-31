import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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
      <header className="border-b border-slate-200 dark:border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-500">
            Corridor Freight
          </span>
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link
              href="/login"
              className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-md bg-brand-600 px-4 py-2 text-white transition hover:bg-brand-700"
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

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
        <section className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/50">
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

        {/* Pricing preview */}
        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
              Simple, flat pricing
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              No per-mile fees or surprise add-ons. Pick the plan that
              matches your fleet.
            </p>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <PricingPreviewCard
              name="Starter"
              price="$85/mo"
              detail="Up to 10 drivers"
              planKey="starter"
            />
            <PricingPreviewCard
              name="Growth"
              price="$125/mo"
              detail="Up to 25 drivers"
              planKey="growth"
              highlighted
            />
            <PricingPreviewCard
              name="Fleet"
              price="$750/mo"
              detail="Up to 30 drivers"
              planKey="fleet"
            />
          </div>

          <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
            <Link
              href="/signup"
              className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Sign up to see full pricing details →
            </Link>
          </p>
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

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-500">
        Corridor Freight
      </footer>
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

function PricingPreviewCard({
  name,
  price,
  detail,
  planKey,
  highlighted,
}: {
  name: string;
  price: string;
  detail: string;
  planKey: "starter" | "growth" | "fleet";
  highlighted?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-xl border p-6 text-center ${
        highlighted
          ? "border-brand-500 ring-1 ring-brand-500"
          : "border-slate-200 dark:border-slate-800"
      }`}
    >
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {name}
      </h3>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {price}
      </p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {detail}
      </p>
      <Link
        href={`/signup?plan=${planKey}`}
        className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        Choose {name}
      </Link>
    </div>
  );
}
