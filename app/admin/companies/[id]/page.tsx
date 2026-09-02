import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import { getAdminCompanyDetail } from "@/lib/admin/queries";
import { formatPrice } from "@/lib/billing-format";
import { SubscriptionBadge, Card } from "../../_components/ui";

export const dynamic = "force-dynamic";

/**
 * /admin/companies/[id] — the drill-in. Full plan/subscription detail,
 * the driver roster, a recent-loads count as a "are they actually using
 * this" signal (there's no events/analytics table, so load creation in
 * the last 30 days is the best proxy available), and the owner contact.
 *
 * Read-only in v1 — nothing on this page edits anything (ROADMAP §101).
 */
export default async function AdminCompanyDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePlatformAdmin();

  const company = await getAdminCompanyDetail(params.id);
  if (!company) notFound();

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <>
      <Link
        href="/admin/companies"
        className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
      >
        ← All companies
      </Link>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          {company.name}
        </h1>
        <SubscriptionBadge status={company.subscriptionStatus} />
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Signed up {fmtDate(company.createdAt)}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Plan &amp; subscription">
          <dl className="space-y-3 text-sm">
            <Row label="Plan">
              {company.plan
                ? `${company.plan.name} (up to ${
                    company.plan.driverLimit != null &&
                    company.plan.driverLimit >= 9999
                      ? "∞"
                      : company.plan.driverLimit
                  } drivers)`
                : "—"}
            </Row>
            <Row label="List price">
              {company.plan ? formatPrice(company.plan.monthlyPriceCents) : "—"}
            </Row>
            <Row label="Status">
              <SubscriptionBadge status={company.subscriptionStatus} />
            </Row>
            {company.pastDueSince && (
              <Row label="Past due since">
                {fmtDate(company.pastDueSince)}
              </Row>
            )}
            <Row label="Stripe customer">
              <Mono value={company.stripeCustomerId} />
            </Row>
            <Row label="Stripe subscription">
              <Mono value={company.stripeSubscriptionId} />
            </Row>
          </dl>
        </Card>

        <Card title="Activity">
          <p className="text-3xl font-semibold text-slate-900 dark:text-slate-100">
            {company.loadsLast30Days}
          </p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            loads created in the last 30 days
          </p>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            {company.loadsAllTime} loads all-time ·{" "}
            {company.activeDriverCount} active{" "}
            {company.activeDriverCount === 1 ? "driver" : "drivers"}
          </p>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            There&apos;s no separate analytics table — recent load creation is
            the best available proxy for whether this company is actively
            using the product.
          </p>
        </Card>

        <Card title={`Drivers (${company.drivers.length})`}>
          {company.drivers.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No drivers on record.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {company.drivers.map((driver, i) => (
                <li
                  key={`${driver.name}-${i}`}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="text-slate-900 dark:text-slate-100">
                    {driver.name}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      driver.status === "active"
                        ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {driver.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Owner contact">
          {company.owner ? (
            <div className="text-sm">
              <p className="text-slate-900 dark:text-slate-100">
                {company.owner.name ?? "(name pending)"}
              </p>
              {company.owner.email ? (
                <a
                  href={`mailto:${company.owner.email}`}
                  className="text-brand-700 hover:underline dark:text-brand-400"
                >
                  {company.owner.email}
                </a>
              ) : (
                <p className="text-slate-400 dark:text-slate-500">
                  no email on file
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No owner-role profile for this company.
            </p>
          )}
        </Card>
      </div>

      <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
        Read-only. Editing a company&apos;s data, and &ldquo;log in as this
        company,&rdquo; are deliberately not part of v1 (ROADMAP §101).
      </p>
    </>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

function Mono({ value }: { value: string | null }) {
  if (!value) return <span className="text-slate-400 dark:text-slate-500">—</span>;
  return (
    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {value}
    </code>
  );
}
