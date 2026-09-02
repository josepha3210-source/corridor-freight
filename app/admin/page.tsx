import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getAdminOverview } from "@/lib/admin/queries";
import { formatCurrency } from "@/lib/format";
import { formatPrice } from "@/lib/billing-format";
import { StatTile, Card } from "./_components/ui";

export const dynamic = "force-dynamic";

/**
 * /admin — the platform overview. Business visibility, not one company's
 * operations: how many tenants exist, what they're paying, how the
 * subscription base splits, roughly how much revenue that is.
 *
 * Every number here is computed from real rows (`lib/admin/queries.ts`).
 * The one figure that can't be fully computed — MRR for quote-based
 * ("Custom / Enterprise") plans, which have no price in the schema and
 * aren't in Stripe yet — is shown honestly with the count of what it
 * excludes, never guessed at (ROADMAP §101).
 */
export default async function AdminOverviewPage() {
  await requirePlatformAdmin();

  const overview = await getAdminOverview();
  const {
    totalCompanies,
    statusCounts,
    otherStatusCount,
    totalActiveDrivers,
    newCompaniesLast7Days,
    newCompaniesThisMonth,
    mrrCents,
    mrrExcludedActiveCompanies,
    planTiers,
  } = overview;

  const totalTierCompanies = planTiers.reduce((s, t) => s + t.companyCount, 0);
  const totalTierDrivers = planTiers.reduce((s, t) => s + t.activeDriverCount, 0);

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Platform overview
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Every company signed up to Corridor Freight — across all tenants.
      </p>

      {/* Headline counts */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile
          label="Total companies"
          value={totalCompanies}
          href="/admin/companies"
        />
        <StatTile label="Active subscriptions" value={statusCounts.active} />
        <StatTile label="Trialing" value={statusCounts.trialing} />
        <StatTile label="Past due" value={statusCounts.past_due} />
        <StatTile
          label="MRR"
          value={formatCurrency(mrrCents / 100)}
          hint="Priced plans on an active subscription"
        />
        <StatTile label="Total active drivers" value={totalActiveDrivers} />
        <StatTile
          label="New companies · last 7 days"
          value={newCompaniesLast7Days}
        />
        <StatTile
          label="New companies · this month"
          value={newCompaniesThisMonth}
        />
      </div>

      {/* MRR / status caveats — stated, not buried */}
      <div className="mt-4 space-y-1 text-xs text-slate-500 dark:text-slate-500">
        <p>
          MRR sums <code>monthly_price_cents</code> for companies whose
          subscription is <strong>active</strong>, joined through their plan.
          {mrrExcludedActiveCompanies > 0 ? (
            <>
              {" "}
              It excludes {mrrExcludedActiveCompanies} active{" "}
              {mrrExcludedActiveCompanies === 1 ? "company" : "companies"} on a
              quote-based plan (Custom / Enterprise) with no price in the schema
              and no Stripe subscription yet — so the real figure is higher than
              shown.
            </>
          ) : (
            <> No active companies are on a quote-based plan right now.</>
          )}
        </p>
        <p>
          Canceled: {statusCounts.canceled}
          {otherStatusCount > 0
            ? ` · other/unrecognized status: ${otherStatusCount}`
            : ""}
          .
        </p>
      </div>

      {/* Plan-tier breakdown */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          By plan tier
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                  Plan
                </th>
                <th className="px-5 py-3 font-medium text-slate-500 dark:text-slate-400">
                  Price
                </th>
                <th className="px-5 py-3 text-right font-medium text-slate-500 dark:text-slate-400">
                  Companies
                </th>
                <th className="px-5 py-3 text-right font-medium text-slate-500 dark:text-slate-400">
                  Active drivers
                </th>
              </tr>
            </thead>
            <tbody>
              {planTiers.map((tier) => (
                <tr
                  key={tier.key}
                  className="border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                >
                  <td className="px-5 py-3 text-slate-900 dark:text-slate-100">
                    {tier.name}
                    <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                      up to{" "}
                      {tier.driverLimit >= 9999 ? "∞" : tier.driverLimit} drivers
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                    {formatPrice(tier.monthlyPriceCents)}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-900 dark:text-slate-100">
                    {tier.companyCount}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-900 dark:text-slate-100">
                    {tier.activeDriverCount}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 font-medium dark:border-slate-700">
                <td className="px-5 py-3 text-slate-900 dark:text-slate-100">
                  Total
                </td>
                <td className="px-5 py-3" />
                <td className="px-5 py-3 text-right tabular-nums text-slate-900 dark:text-slate-100">
                  {totalTierCompanies}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-900 dark:text-slate-100">
                  {totalTierDrivers}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* v1 scope — what this view deliberately does not do */}
      <section className="mt-10">
        <Card title="Not in this view (v1)">
          <ul className="space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
            <li>
              <strong className="text-slate-700 dark:text-slate-300">
                No editing.
              </strong>{" "}
              Every /admin page is read-only — no company&apos;s data can be
              changed from here.
            </li>
            <li>
              <strong className="text-slate-700 dark:text-slate-300">
                No &ldquo;log in as this company.&rdquo;
              </strong>{" "}
              Impersonation has its own consent and security questions and
              isn&apos;t part of the first cut.
            </li>
            <li>
              <strong className="text-slate-700 dark:text-slate-300">
                No historical MRR trend.
              </strong>{" "}
              The schema stores only current <code>subscription_status</code> —
              there&apos;s no snapshot table, so a trend line would need a
              nightly snapshot job or Stripe&apos;s own history. Deliberately
              deferred to v2 rather than faked.
            </li>
          </ul>
        </Card>
      </section>
    </>
  );
}
