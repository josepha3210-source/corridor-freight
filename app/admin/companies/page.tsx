import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/admin/auth";
import {
  getAdminCompanies,
  getPlanCatalog,
  type AdminCompanyListRow,
} from "@/lib/admin/queries";
import { SubscriptionBadge } from "../_components/ui";

export const dynamic = "force-dynamic";

/**
 * /admin/companies — the table this dashboard is really for. One row per
 * tenant: plan, subscription status, drivers used vs. the tier's limit,
 * signup date, and the owner-role profile as a contact.
 *
 * Sort and plan filter are plain URL state (`?sort=`, `?dir=`,
 * `?plan=`), read from `searchParams` and applied in memory — the whole
 * tenant list is small enough that paging or a server-side ORDER BY
 * would be premature. Read-only: rows link through to a detail page,
 * nothing here mutates.
 */

type SortKey = "created" | "drivers";
type SortDir = "asc" | "desc";

function sortRows(
  rows: AdminCompanyListRow[],
  sort: SortKey,
  dir: SortDir
): AdminCompanyListRow[] {
  const factor = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sort === "drivers") {
      if (a.activeDrivers !== b.activeDrivers) {
        return (a.activeDrivers - b.activeDrivers) * factor;
      }
      // stable tiebreak so equal-driver rows don't jump around
      return a.name.localeCompare(b.name);
    }
    return a.createdAt.localeCompare(b.createdAt) * factor;
  });
}

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}

export default async function AdminCompaniesPage({
  searchParams,
}: {
  searchParams: { sort?: string; dir?: string; plan?: string };
}) {
  await requirePlatformAdmin();

  const sort: SortKey = searchParams.sort === "drivers" ? "drivers" : "created";
  const dir: SortDir = searchParams.dir === "asc" ? "asc" : "desc";
  const planFilter = searchParams.plan;

  const [allRows, planCatalog] = await Promise.all([
    getAdminCompanies(),
    getPlanCatalog(),
  ]);

  // Plan tabs — every real plan tier (from the `plans` table, in
  // sort_order), so "0 on Fleet" is visible at a glance too, plus any
  // plan key that somehow appears in the data but not the catalog.
  const catalogKeys = new Set(planCatalog.map((p) => p.key));
  const orphanTabs = Array.from(
    new Map(
      allRows
        .filter((r) => !catalogKeys.has(r.planKey))
        .map((r) => [r.planKey, r.planName])
    ).entries()
  ).map(([key, name]) => ({ key, name }));
  const planTabs = [...planCatalog, ...orphanTabs];

  const filtered = planFilter
    ? allRows.filter((r) => r.planKey === planFilter)
    : allRows;
  const rows = sortRows(filtered, sort, dir);

  // A column header link that toggles direction when it's the active
  // sort, or switches to that column (defaulting to desc) when it isn't.
  function sortHref(key: SortKey) {
    const nextDir: SortDir = sort === key && dir === "desc" ? "asc" : "desc";
    return `/admin/companies${buildQuery({
      sort: key,
      dir: nextDir,
      plan: planFilter,
    })}`;
  }
  const arrow = (key: SortKey) =>
    sort === key ? (dir === "desc" ? " ↓" : " ↑") : "";

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Companies
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        {allRows.length} total
        {planFilter ? ` · ${rows.length} on this plan` : ""}
      </p>

      {/* Plan filter */}
      <div className="mt-4 flex flex-wrap gap-2">
        <FilterTab
          label="All"
          href={`/admin/companies${buildQuery({ sort, dir })}`}
          active={!planFilter}
        />
        {planTabs.map((tab) => (
          <FilterTab
            key={tab.key}
            label={tab.name}
            href={`/admin/companies${buildQuery({ sort, dir, plan: tab.key })}`}
            active={planFilter === tab.key}
          />
        ))}
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <Th>Company</Th>
              <Th>Plan</Th>
              <Th>Status</Th>
              <th className="px-4 py-3 text-right font-medium text-slate-500 dark:text-slate-400">
                <Link href={sortHref("drivers")} className="hover:text-brand-700 dark:hover:text-brand-400">
                  Drivers{arrow("drivers")}
                </Link>
              </th>
              <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
                <Link href={sortHref("created")} className="hover:text-brand-700 dark:hover:text-brand-400">
                  Signed up{arrow("created")}
                </Link>
              </th>
              <Th>Owner contact</Th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                >
                  No companies match this filter.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const atLimit =
                  row.driverLimit != null &&
                  row.activeDrivers >= row.driverLimit;
                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-b-0 dark:border-slate-800"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/companies/${row.id}`}
                        className="font-medium text-brand-700 hover:underline dark:text-brand-400"
                      >
                        {row.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                      {row.planName}
                    </td>
                    <td className="px-4 py-3">
                      <SubscriptionBadge status={row.subscriptionStatus} />
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums ${
                        atLimit
                          ? "font-medium text-red-600 dark:text-red-400"
                          : "text-slate-900 dark:text-slate-100"
                      }`}
                    >
                      {row.activeDrivers} /{" "}
                      {row.driverLimit == null
                        ? "—"
                        : row.driverLimit >= 9999
                          ? "∞"
                          : row.driverLimit}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                      {new Date(row.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      {row.owner ? (
                        <div className="min-w-0">
                          <p className="truncate text-slate-900 dark:text-slate-100">
                            {row.owner.name ?? "(name pending)"}
                          </p>
                          {row.owner.email ? (
                            <a
                              href={`mailto:${row.owner.email}`}
                              className="truncate text-xs text-brand-700 hover:underline dark:text-brand-400"
                            >
                              {row.owner.email}
                            </a>
                          ) : (
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              no email on file
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500">
                          no owner profile
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">
      {children}
    </th>
  );
}

function FilterTab({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
        active
          ? "bg-brand-600 text-white ring-brand-600"
          : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </Link>
  );
}
