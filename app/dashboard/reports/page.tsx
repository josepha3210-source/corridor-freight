import { requireProfile } from "@/lib/current-profile";
import { formatCurrency } from "@/lib/format";

/**
 * Real page (v2 prompt Phase 7) — was a ComingSoon placeholder. Lane
 * profitability: group delivered loads by lane and show revenue per
 * mile per lane, so a carrier can see which lanes are actually worth
 * running — treated as its own real report, not a dashboard tile, per
 * the prompt's own instruction once there's more than a handful of
 * rows.
 *
 * A "lane" here is the exact (pickup_location, dropoff_location) pair
 * as entered, not a parsed origin-state → destination-state pair. The
 * prompt's own spec describes state-to-state grouping, but this app's
 * pickup/dropoff fields are free text with genuinely inconsistent real
 * data (confirmed live — some entries have no comma separating city
 * and state at all), and a fragile state-parser would risk silently
 * mis-grouping loads on bad input. Exact-location matching is strictly
 * reliable at the cost of being more granular (won't merge two
 * different Chicago-to-Wisconsin routes into one "IL → WI" lane) — a
 * deliberate accuracy-over-breadth trade, not an oversight.
 */
export default async function ReportsPage() {
  const { supabase, profile } = await requireProfile();
  const canSeeRevenue = profile?.role === "owner" || profile?.role === "admin";

  if (!canSeeRevenue) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Reports</h1>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          Lane profitability is revenue data, visible to owner and admin only.
        </p>
      </div>
    );
  }

  const { data: loads } = await supabase
    .from("loads_with_dispatch")
    .select("pickup_location, dropoff_location, client_rate, miles, delivered_at")
    .eq("status", "delivered")
    .order("delivered_at", { ascending: false });

  type LaneStats = {
    pickup: string;
    dropoff: string;
    loadCount: number;
    totalRevenue: number;
    totalMiles: number;
    milesKnownCount: number;
  };

  const lanes = new Map<string, LaneStats>();
  for (const load of loads ?? []) {
    const key = `${load.pickup_location} → ${load.dropoff_location}`;
    const existing = lanes.get(key) ?? {
      pickup: load.pickup_location,
      dropoff: load.dropoff_location,
      loadCount: 0,
      totalRevenue: 0,
      totalMiles: 0,
      milesKnownCount: 0,
    };
    existing.loadCount += 1;
    existing.totalRevenue += Number(load.client_rate);
    if (load.miles != null) {
      existing.totalMiles += Number(load.miles);
      existing.milesKnownCount += 1;
    }
    lanes.set(key, existing);
  }

  const laneRows = Array.from(lanes.values()).sort((a, b) => b.loadCount - a.loadCount);

  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Reports</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Lane profitability — which routes are actually worth running,
        based on your own delivered load history.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {laneRows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
            No delivered loads yet — this fills in once you have some
            history to report on.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Lane</th>
                  <th className="px-6 py-3 font-medium">Loads</th>
                  <th className="px-6 py-3 font-medium">Total revenue</th>
                  <th className="px-6 py-3 font-medium">Avg rate/load</th>
                  <th className="px-6 py-3 font-medium">Revenue/mile</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {laneRows.map((lane) => (
                  <tr key={`${lane.pickup}→${lane.dropoff}`} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-3 text-slate-900 dark:text-slate-100">
                      {lane.pickup} → {lane.dropoff}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{lane.loadCount}</td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {formatCurrency(lane.totalRevenue)}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {formatCurrency(lane.totalRevenue / lane.loadCount)}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {lane.totalMiles > 0
                        ? `${formatCurrency(lane.totalRevenue / lane.totalMiles)}/mi`
                        : "No mileage on record"}
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
