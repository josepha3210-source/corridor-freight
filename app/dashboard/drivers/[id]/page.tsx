import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/current-profile";
import { AddIncidentForm } from "./AddIncidentForm";
import { CATEGORY_LABEL } from "@/lib/driver-incident-categories";

/**
 * Driver scorecard (v2 prompt Phase 7) — on-time rate, POD/signature
 * compliance, and DVIR pass rate are all rolled up server-side by
 * driver_scorecard() (0033), which aggregates dispatches/load_stops/
 * dvir_reports the same way a hand-written query on this page would —
 * it isn't security definer, so RLS applies exactly as normal. Only
 * the manual incident log is new data; the three rates are just a new
 * view onto records this app already keeps.
 *
 * Each rate shows "No data yet" instead of a fabricated 0% when its
 * sample size is 0 — a driver who hasn't delivered anything yet
 * shouldn't read as having a bad on-time record.
 */
export default async function DriverScorecardPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, profile } = await requireProfile();

  const { data: driver } = await supabase
    .from("drivers")
    .select("id, full_name, phone, email, status")
    .eq("id", params.id)
    .single();

  if (!driver) {
    notFound();
  }

  const [{ data: scorecardRows }, { data: incidents }] = await Promise.all([
    supabase.rpc("driver_scorecard", { p_driver_id: params.id }),
    supabase
      .from("driver_incidents")
      .select("id, category, occurred_at, description, created_at")
      .eq("driver_id", params.id)
      .order("occurred_at", { ascending: false }),
  ]);

  // supabase-js has no generated types for this project — same
  // untyped-RPC pattern as every other RPC call in this app.
  const scorecard = (scorecardRows?.[0] ?? null) as unknown as {
    delivered_load_count: number;
    on_time_rate: number | null;
    on_time_sample_size: number;
    pod_compliance_rate: number | null;
    pod_sample_size: number;
    dvir_pass_rate: number | null;
    dvir_sample_size: number;
  } | null;

  return (
    <>
      <Link
        href="/dashboard/drivers"
        className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
      >
        ← All drivers
      </Link>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            {driver.full_name}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {driver.phone || "No phone on file"} · {driver.email || "No email on file"} ·{" "}
            {driver.status}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <ScoreTile
          label="On-time delivery rate"
          rate={scorecard?.on_time_rate ?? null}
          sampleSize={scorecard?.on_time_sample_size ?? 0}
          sampleLabel="delivered load"
        />
        <ScoreTile
          label="POD / signature compliance"
          rate={scorecard?.pod_compliance_rate ?? null}
          sampleSize={scorecard?.pod_sample_size ?? 0}
          sampleLabel="delivered load"
        />
        <ScoreTile
          label="DVIR pass rate"
          rate={scorecard?.dvir_pass_rate ?? null}
          sampleSize={scorecard?.dvir_sample_size ?? 0}
          sampleLabel="inspection"
        />
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Incident log
          </h2>
          {profile?.company_id && (
            <AddIncidentForm driverId={driver.id} companyId={profile.company_id} />
          )}
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {!incidents || incidents.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
              No incidents logged.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {incidents.map((incident) => (
                <div key={incident.id} className="p-4">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {CATEGORY_LABEL[incident.category] ?? incident.category}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(incident.occurred_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
                    {incident.description}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function ScoreTile({
  label,
  rate,
  sampleSize,
  sampleLabel,
}: {
  label: string;
  rate: number | null;
  sampleSize: number;
  sampleLabel: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
      {rate == null ? (
        <p className="mt-2 text-xl font-semibold text-slate-400 dark:text-slate-600">
          No data yet
        </p>
      ) : (
        <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
          {(rate * 100).toFixed(0)}%
        </p>
      )}
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {sampleSize} {sampleLabel}
        {sampleSize === 1 ? "" : "s"} on record
      </p>
    </div>
  );
}
