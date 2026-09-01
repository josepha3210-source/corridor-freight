import Link from "next/link";
import { requireProfile } from "@/lib/current-profile";
import { formatCurrency } from "@/lib/format";

/**
 * "Just an internal view of your own undispatched loads, not a public
 * marketplace" — per the Phase 1 spec. Same driver_id-is-null filter the
 * dashboard's own "Unassigned loads" section already uses (not
 * status = 'unassigned' — editing a load can clear its driver without
 * the status column reverting, a known gap tracked separately), so this
 * page and that section can never disagree about what still needs a
 * driver. Read-only: assigning a driver happens from the load's own
 * detail page, not inline here — no need for a second place that can
 * mutate a load's driver_id.
 */
export default async function LoadBoardPage() {
  const { supabase } = await requireProfile();

  // loads_with_dispatch (0017) — driver_id/status now live on the
  // dispatch, exposed flat here by the view.
  const { data: loads } = await supabase
    .from("loads_with_dispatch")
    .select(
      "id, load_number, client_name, pickup_location, pickup_at, dropoff_location, dropoff_at, client_rate, driver_pay"
    )
    .is("driver_id", null)
    .neq("status", "cancelled")
    .order("pickup_at", { ascending: true, nullsFirst: false });

  const openLoads = loads ?? [];

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        Load Board
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Every load that still needs a driver — an internal view, not a
        public marketplace.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {openLoads.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
            Every load has a driver assigned.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Load #</th>
                  <th className="px-6 py-3 font-medium">Client</th>
                  <th className="px-6 py-3 font-medium">Route</th>
                  <th className="px-6 py-3 font-medium">Pickup</th>
                  <th className="px-6 py-3 font-medium">Rate / Pay</th>
                  <th className="px-6 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {openLoads.map((load) => (
                  <tr key={load.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {load.load_number}
                    </td>
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {load.client_name}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {load.pickup_location} → {load.dropoff_location}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {load.pickup_at
                        ? new Date(load.pickup_at).toLocaleDateString()
                        : "No pickup time set"}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {formatCurrency(Number(load.client_rate))} /{" "}
                      {formatCurrency(Number(load.driver_pay))}
                    </td>
                    <td className="px-6 py-3 text-right">
                      <Link
                        href={`/dashboard/loads/${load.id}`}
                        className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
                      >
                        Assign driver →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
