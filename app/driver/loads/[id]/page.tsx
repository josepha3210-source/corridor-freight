import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/StatusBadge";
import { DeliveryConfirmationForm } from "@/components/DeliveryConfirmationForm";
import { requireDriver } from "@/lib/current-driver";
import { MarkInTransitButton } from "../../MarkInTransitButton";

/**
 * Same RLS-does-the-filtering approach as the dashboard's own load
 * detail page: this simply returns no row (not another driver's or
 * another company's load) if the id isn't assigned to this driver, so
 * notFound() below covers "doesn't exist" and "not yours" identically.
 */
export default async function DriverLoadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, driver } = await requireDriver();
  if (!driver) return null;

  // loads_with_dispatch (0017) — dispatch_id is what MarkInTransitButton
  // and DeliveryConfirmationForm actually write to now.
  const { data: load } = await supabase
    .from("loads_with_dispatch")
    .select(
      "id, dispatch_id, load_number, client_name, pickup_location, pickup_at, dropoff_location, dropoff_at, status, driver_id, signed_by_name, signature_data, delivered_at"
    )
    .eq("id", params.id)
    .single();

  if (!load) {
    notFound();
  }

  const isDelivered = load.status === "delivered";
  const isCancelled = load.status === "cancelled";
  const isTerminal = isDelivered || isCancelled;

  return (
    <>
      <Link
        href="/driver"
        className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
      >
        ← My loads
      </Link>

      <div className="mt-4 space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {load.load_number}
              </p>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {load.client_name}
              </h1>
            </div>
            <StatusBadge status={load.status} />
          </div>

          <dl className="mt-3 space-y-2 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Pickup
              </dt>
              <dd className="text-slate-900 dark:text-slate-100">
                {load.pickup_location}
              </dd>
              <dd className="text-xs text-slate-500 dark:text-slate-400">
                {formatDateTime(load.pickup_at)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Dropoff
              </dt>
              <dd className="text-slate-900 dark:text-slate-100">
                {load.dropoff_location}
              </dd>
              <dd className="text-xs text-slate-500 dark:text-slate-400">
                {formatDateTime(load.dropoff_at)}
              </dd>
            </div>
          </dl>
        </div>

        {load.status === "assigned" && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <MarkInTransitButton dispatchId={load.dispatch_id} />
          </div>
        )}

        {load.status === "in_transit" && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Delivery confirmation
            </h2>
            <div className="mt-2">
              <DeliveryConfirmationForm dispatchId={load.dispatch_id} driverId={load.driver_id} />
            </div>
          </div>
        )}

        {isDelivered && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Delivered
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Signed by <strong>{load.signed_by_name}</strong> on{" "}
              {formatDateTime(load.delivered_at)}.
            </p>
            {load.signature_data && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={load.signature_data}
                alt={`Signature of ${load.signed_by_name ?? "recipient"}`}
                className="mt-3 max-w-xs rounded-md border border-slate-200 bg-white dark:border-slate-700"
              />
            )}
          </div>
        )}

        {isCancelled && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            This load was cancelled.
          </p>
        )}
      </div>
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
