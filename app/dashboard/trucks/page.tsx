import { requireProfile } from "@/lib/current-profile";
import { AddTruckForm } from "./AddTruckForm";

const STATUS_CLASSES: Record<string, string> = {
  active: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  maintenance: "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400",
  inactive: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

/**
 * Real page now (Phase 3a) — was a ComingSoon placeholder in Phase 1.
 * Same company-scoped RLS pattern as Drivers (0016); no archive/status
 * toggle UI yet (a truck's `status` is settable at creation and via a
 * future edit, not built as an inline row action here — smaller surface
 * area for now, matching "don't overbuild" until this is actually used).
 */
export default async function TrucksPage() {
  const { supabase, profile } = await requireProfile();

  const [{ data: trucks }, { data: drivers }] = await Promise.all([
    supabase
      .from("trucks")
      .select(
        "id, make, model, year, vin, plate_number, plate_state, status, odometer, registration_expires_at, insurance_expires_at, next_inspection_due_at, drivers ( full_name )"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("drivers")
      .select("id, full_name")
      .eq("status", "active")
      .order("full_name"),
  ]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Trucks & Equipment
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Your fleet — registration, insurance, and inspection dates.
          </p>
        </div>
        {profile?.company_id && (
          <AddTruckForm companyId={profile.company_id} drivers={drivers ?? []} />
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {!trucks || trucks.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
            No trucks yet. Add your first one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Truck</th>
                  <th className="px-6 py-3 font-medium">Plate</th>
                  <th className="px-6 py-3 font-medium">Driver</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Registration</th>
                  <th className="px-6 py-3 font-medium">Insurance</th>
                  <th className="px-6 py-3 font-medium">Next inspection</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {trucks.map((truck) => {
                  const driverName = (
                    truck.drivers as unknown as { full_name: string } | null
                  )?.full_name;
                  return (
                    <tr key={truck.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {[truck.year, truck.make, truck.model].filter(Boolean).join(" ") ||
                          "—"}
                        {truck.vin && (
                          <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                            {truck.vin}
                          </p>
                        )}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {[truck.plate_number, truck.plate_state].filter(Boolean).join(" ") ||
                          "—"}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {driverName || "Unassigned"}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            STATUS_CLASSES[truck.status] ?? STATUS_CLASSES.inactive
                          }`}
                        >
                          {truck.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {formatDate(truck.registration_expires_at)}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {formatDate(truck.insurance_expires_at)}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {formatDate(truck.next_inspection_due_at)}
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

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}
