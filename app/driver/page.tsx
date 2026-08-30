import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { requireDriver } from "@/lib/current-driver";
import { MarkInTransitButton } from "./MarkInTransitButton";

/**
 * No driver_id filter here — migration 0006's "drivers can view their
 * own assigned loads" RLS policy already scopes this query to exactly
 * this driver's own loads. That's deliberate: the page can't accidentally
 * show someone else's load even if this code had a bug, because the
 * database itself won't return the row.
 */
export default async function DriverDashboardPage() {
  const { supabase, driver } = await requireDriver();
  if (!driver) return null;

  const { data: loads } = await supabase
    .from("loads")
    .select(
      "id, load_number, client_name, pickup_location, pickup_at, dropoff_location, dropoff_at, status"
    )
    .in("status", ["assigned", "in_transit"])
    .order("pickup_at", { ascending: true, nullsFirst: false });

  const activeLoads = loads ?? [];

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        My Loads
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Today&apos;s and upcoming assigned loads.
      </p>

      {activeLoads.length === 0 ? (
        <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          No loads assigned to you right now.
        </p>
      ) : (
        <div className="mt-6 space-y-4">
          {activeLoads.map((load) => (
            <div
              key={load.id}
              className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {load.load_number}
                  </p>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {load.client_name}
                  </p>
                </div>
                <StatusBadge status={load.status} />
              </div>

              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Pickup</dt>
                  <dd className="text-right text-slate-900 dark:text-slate-100">
                    {load.pickup_location}
                    <br />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(load.pickup_at)}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Dropoff</dt>
                  <dd className="text-right text-slate-900 dark:text-slate-100">
                    {load.dropoff_location}
                    <br />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(load.dropoff_at)}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center gap-3">
                {load.status === "assigned" && (
                  <MarkInTransitButton loadId={load.id} />
                )}
                <Link
                  href={`/driver/loads/${load.id}`}
                  className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
                >
                  {load.status === "in_transit"
                    ? "Confirm delivery →"
                    : "View details →"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "No time set";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
