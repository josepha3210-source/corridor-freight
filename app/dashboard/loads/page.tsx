import Link from "next/link";
import { requireProfile } from "@/lib/current-profile";
import { CreateLoadForm } from "./CreateLoadForm";
import { StatusBadge } from "@/components/StatusBadge";
import { DownloadCsvButton, type LoadCsvRow } from "./DownloadCsvButton";

const STATUSES = [
  "unassigned",
  "assigned",
  "in_transit",
  "delivered",
  "cancelled",
] as const;

export default async function LoadsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const { supabase, profile } = await requireProfile();

  const statusFilter = STATUSES.includes(searchParams.status as (typeof STATUSES)[number])
    ? searchParams.status
    : undefined;

  let loadsQuery = supabase
    .from("loads")
    .select(
      "id, load_number, client_name, pickup_location, dropoff_location, status, client_rate, driver_pay, driver_id, drivers ( full_name )"
    )
    .order("created_at", { ascending: false });

  if (statusFilter) {
    loadsQuery = loadsQuery.eq("status", statusFilter);
  }

  const [{ data: loads }, { data: drivers }] = await Promise.all([
    loadsQuery,
    supabase
      .from("drivers")
      .select("id, full_name")
      .eq("status", "active")
      .order("full_name"),
  ]);

  const csvRows: LoadCsvRow[] = (loads ?? []).map((load) => {
    const driverName =
      (load.drivers as unknown as { full_name: string } | null)?.full_name ??
      "Unassigned";
    return {
      load_number: load.load_number,
      client_name: load.client_name,
      driver_name: driverName,
      pickup_location: load.pickup_location,
      dropoff_location: load.dropoff_location,
      status: load.status,
      client_rate: Number(load.client_rate),
      driver_pay: Number(load.driver_pay),
      margin: Number(load.client_rate) - Number(load.driver_pay),
    };
  });

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Loads</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Dispatch board — assign drivers and track every load to
            delivery.
          </p>
        </div>
        <div className="flex gap-3">
          <DownloadCsvButton rows={csvRows} />
          {profile?.company_id && (
            <CreateLoadForm
              companyId={profile.company_id}
              drivers={drivers ?? []}
            />
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <FilterPill label="All" href="/dashboard/loads" active={!statusFilter} />
        {STATUSES.map((s) => (
          <FilterPill
            key={s}
            label={s.replace("_", " ")}
            href={`/dashboard/loads?status=${s}`}
            active={statusFilter === s}
          />
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {!loads || loads.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
            {statusFilter
              ? `No ${statusFilter.replace("_", " ")} loads.`
              : "No loads yet. Create your first one above."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Load #</th>
                  <th className="px-6 py-3 font-medium">Client</th>
                  <th className="px-6 py-3 font-medium">Route</th>
                  <th className="px-6 py-3 font-medium">Driver</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Rate / Pay</th>
                  <th className="px-6 py-3 font-medium">Margin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loads.map((load) => {
                  const driverName = (
                    load.drivers as unknown as { full_name: string } | null
                  )?.full_name;
                  const margin =
                    Number(load.client_rate) - Number(load.driver_pay);
                  return (
                    <tr key={load.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                        <Link
                          href={`/dashboard/loads/${load.id}`}
                          className="hover:underline"
                        >
                          {load.load_number}
                        </Link>
                      </td>
                      <td className="px-6 py-3">
                        <Link
                          href={`/dashboard/loads/${load.id}`}
                          className="font-medium text-brand-700 hover:underline dark:text-brand-400"
                        >
                          {load.client_name}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {load.pickup_location} → {load.dropoff_location}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {driverName || "Unassigned"}
                      </td>
                      <td className="px-6 py-3">
                        <StatusBadge status={load.status} />
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        ${Number(load.client_rate).toFixed(2)} / $
                        {Number(load.driver_pay).toFixed(2)}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        ${margin.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function FilterPill({
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
      className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition ${
        active
          ? "bg-brand-600 text-white"
          : "bg-white text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-400 dark:ring-slate-700 dark:hover:bg-slate-800"
      }`}
    >
      {label}
    </Link>
  );
}
