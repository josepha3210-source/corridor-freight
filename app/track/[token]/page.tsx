import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CorridorLogo } from "@/components/CorridorLogo";

const STEPS = [
  { key: "unassigned", label: "Booked" },
  { key: "assigned", label: "Dispatched" },
  { key: "in_transit", label: "In transit" },
  { key: "delivered", label: "Delivered" },
] as const;

/**
 * Public, no-login tracking page (v2 prompt Phase 7) — a shipper with
 * this link sees status and an ETA without calling to ask "where's my
 * truck." Reads through public_track_dispatch() (0031), a SECURITY
 * DEFINER function that's the only thing that can see this row without
 * a real session — the token in the URL is the entire authorization,
 * so there's deliberately no way to browse or guess into another
 * dispatch's tracking page from this one.
 *
 * ETA is computed from the dispatch's own scheduled dropoff time, not
 * a live GPS estimate this app has no way to produce — degrades
 * honestly to "not yet available" once a load is delivered or if no
 * dropoff time was ever set, rather than showing a stale or fabricated
 * number.
 */
export default async function TrackingPage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createClient();
  const { data: rawData } = await supabase
    .rpc("public_track_dispatch", { p_token: params.token })
    .maybeSingle();

  if (!rawData) {
    notFound();
  }

  // supabase-js has no generated types for this project, so an RPC
  // call comes back untyped ({}) same as every other RPC in this app —
  // cast once here rather than threading `any` through.
  const data = rawData as unknown as {
    load_number: string;
    status: string;
    pickup_location: string | null;
    pickup_at: string | null;
    dropoff_location: string | null;
    dropoff_at: string | null;
    delivered_at: string | null;
  };

  const currentStepIndex = STEPS.findIndex((s) => s.key === data.status);
  const isCancelled = data.status === "cancelled";
  const isDelivered = data.status === "delivered";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CorridorLogo />

        <p className="mt-6 font-mono text-xs text-slate-500 dark:text-slate-400">
          {data.load_number}
        </p>

        {isCancelled ? (
          <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
            This load was cancelled.
          </p>
        ) : (
          <>
            <div className="mt-4 flex items-center justify-between">
              {STEPS.map((step, i) => (
                <div key={step.key} className="flex flex-1 flex-col items-center">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      i <= currentStepIndex
                        ? "bg-brand-600"
                        : "bg-slate-200 dark:bg-slate-700"
                    }`}
                  />
                  <p
                    className={`mt-2 text-center text-xs ${
                      i <= currentStepIndex
                        ? "font-medium text-slate-900 dark:text-slate-100"
                        : "text-slate-400 dark:text-slate-600"
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-4 border-t border-slate-100 pt-6 dark:border-slate-800">
              <TrackRow label="Pickup" location={data.pickup_location} at={data.pickup_at} />
              <TrackRow label="Dropoff" location={data.dropoff_location} at={data.dropoff_at} />
            </div>

            <div className="mt-6 rounded-md bg-slate-50 p-3 text-sm dark:bg-slate-800">
              {isDelivered ? (
                <p className="text-slate-700 dark:text-slate-300">
                  Delivered {data.delivered_at ? formatDate(data.delivered_at) : ""}.
                </p>
              ) : data.dropoff_at ? (
                <p className="text-slate-700 dark:text-slate-300">
                  Estimated delivery: {formatDate(data.dropoff_at)}
                </p>
              ) : (
                <p className="text-slate-500 dark:text-slate-400">
                  ETA not yet available.
                </p>
              )}
            </div>
          </>
        )}

        <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-600">
          Powered by Corridor Freight
        </p>
      </div>
    </div>
  );
}

function TrackRow({
  label,
  location,
  at,
}: {
  label: string;
  location: string | null;
  at: string | null;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
        <p className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">{location ?? "—"}</p>
      </div>
      <p className="text-slate-500 dark:text-slate-400">{at ? formatDate(at) : "—"}</p>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
