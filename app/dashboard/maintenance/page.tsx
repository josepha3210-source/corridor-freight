import { requireProfile } from "@/lib/current-profile";
import { AddMaintenanceForm } from "./AddMaintenanceForm";

/**
 * Real page (Phase 5b) — was a ComingSoon placeholder. Two sections:
 * scheduled/completed maintenance (staff-entered), and DVIR reports
 * (driver-filed, read-only here — a DVIR is a signed point-in-time
 * record, same as a delivery signature, not something staff edit).
 */
export default async function MaintenancePage() {
  const { profile, supabase } = await requireProfile();

  const [{ data: records }, { data: trucks }, { data: dvirReports }] = await Promise.all([
    supabase
      .from("maintenance_records")
      .select("id, service_type, service_date, odometer, cost, next_due_at, notes, trucks ( plate_number )")
      .order("service_date", { ascending: false }),
    supabase.from("trucks").select("id, plate_number, make, model").eq("status", "active").order("plate_number"),
    supabase
      .from("dvir_reports")
      .select(
        "id, inspection_type, inspection_date, defects_found, satisfactory, defect_notes, trucks ( plate_number ), drivers ( full_name )"
      )
      .order("inspection_date", { ascending: false })
      .limit(25),
  ]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Maintenance</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Service history per truck, plus driver pre/post-trip
            inspection reports (DVIR).
          </p>
        </div>
        {profile?.company_id && (
          <AddMaintenanceForm companyId={profile.company_id} trucks={trucks ?? []} />
        )}
      </div>

      <section className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Service history
        </h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {!records || records.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
              No maintenance logged yet. Add your first one above.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Truck</th>
                    <th className="px-6 py-3 font-medium">Service</th>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Odometer</th>
                    <th className="px-6 py-3 font-medium">Cost</th>
                    <th className="px-6 py-3 font-medium">Next due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {(r.trucks as unknown as { plate_number: string } | null)?.plate_number ?? "—"}
                      </td>
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {r.service_type}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{r.service_date}</td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {r.odometer ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {r.cost != null ? `$${Number(r.cost).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {r.next_due_at ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          DVIR reports
        </h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {!dvirReports || dvirReports.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
              No inspection reports filed yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-medium">Date</th>
                    <th className="px-6 py-3 font-medium">Type</th>
                    <th className="px-6 py-3 font-medium">Truck</th>
                    <th className="px-6 py-3 font-medium">Driver</th>
                    <th className="px-6 py-3 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dvirReports.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {new Date(d.inspection_date).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {d.inspection_type === "pre_trip" ? "Pre-trip" : "Post-trip"}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {(d.trucks as unknown as { plate_number: string } | null)?.plate_number ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {(d.drivers as unknown as { full_name: string } | null)?.full_name ?? "—"}
                      </td>
                      <td className="px-6 py-3">
                        {d.defects_found ? (
                          <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
                            Defects found
                          </span>
                        ) : (
                          <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/10 dark:text-green-400">
                            No defects
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
