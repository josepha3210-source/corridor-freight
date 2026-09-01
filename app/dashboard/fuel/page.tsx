import { requireProfile } from "@/lib/current-profile";
import { AddFuelPurchaseForm } from "./AddFuelPurchaseForm";

/**
 * Real page (Phase 4c) — was a ComingSoon placeholder in Phase 1. Just
 * capture, no report — Phase 5a's IFTA quarterly report is what
 * actually aggregates these by jurisdiction and quarter; this page's
 * only job is making sure that raw data exists and is correct going in.
 */
export default async function FuelPage() {
  const { profile, supabase } = await requireProfile();

  const [{ data: purchases }, { data: trucks }, { data: drivers }] = await Promise.all([
    supabase
      .from("fuel_purchases")
      .select(
        "id, purchase_date, jurisdiction, gallons, total_amount, odometer, trucks ( plate_number ), drivers ( full_name )"
      )
      .order("purchase_date", { ascending: false }),
    supabase.from("trucks").select("id, plate_number").eq("status", "active").order("plate_number"),
    supabase.from("drivers").select("id, full_name").eq("status", "active").order("full_name"),
  ]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Fuel</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Log fuel purchases per truck and driver — gallons, price, and
            jurisdiction, which is also the input IFTA reporting needs.
          </p>
        </div>
        {profile?.company_id && (
          <AddFuelPurchaseForm
            companyId={profile.company_id}
            trucks={trucks ?? []}
            drivers={drivers ?? []}
          />
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {!purchases || purchases.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
            No fuel purchases logged yet. Add your first one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Date</th>
                  <th className="px-6 py-3 font-medium">Jurisdiction</th>
                  <th className="px-6 py-3 font-medium">Truck</th>
                  <th className="px-6 py-3 font-medium">Driver</th>
                  <th className="px-6 py-3 font-medium">Gallons</th>
                  <th className="px-6 py-3 font-medium">Total</th>
                  <th className="px-6 py-3 font-medium">$/gal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {purchases.map((p) => {
                  const truckPlate =
                    (p.trucks as unknown as { plate_number: string } | null)?.plate_number;
                  const driverName =
                    (p.drivers as unknown as { full_name: string } | null)?.full_name;
                  const perGallon = Number(p.gallons) > 0 ? Number(p.total_amount) / Number(p.gallons) : 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{p.purchase_date}</td>
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {p.jurisdiction}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {truckPlate ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {driverName ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {Number(p.gallons).toFixed(3)}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        ${Number(p.total_amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        ${perGallon.toFixed(3)}
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
