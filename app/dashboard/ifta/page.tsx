import { requireProfile } from "@/lib/current-profile";
import { IFTA_JURISDICTIONS } from "@/lib/ifta-jurisdictions";
import { QuarterPicker } from "./QuarterPicker";
import { DownloadIftaCsvButton, type IftaCsvRow } from "./DownloadIftaCsvButton";

const JURISDICTION_NAME: Record<string, string> = Object.fromEntries(
  IFTA_JURISDICTIONS.map((j) => [j.code, j.name])
);

/**
 * Real page (Phase 5a) — was a ComingSoon placeholder. Report
 * generation only, same as the placeholder always said — no e-filing.
 *
 * A real IFTA return needs two things per jurisdiction: miles driven
 * there, and gallons purchased there. This only ever builds the second
 * half. Per-jurisdiction miles needs real route tracking (which state a
 * truck actually passed through between two points, not just its
 * pickup/dropoff cities) — that depends on the Google Maps Distance
 * Matrix mileage add-on flagged as deliberately deferred back in Phase
 * 3c (ROADMAP §81), and even once that lands it only gives total trip
 * mileage, not a per-state breakdown, which really needs GPS/ELD data
 * this app explicitly doesn't integrate (out of scope per the v2
 * prompt itself). Rather than guess at miles from city-to-city text and
 * present a fabricated number next to real ones, this report is
 * honestly scoped to the half it can actually compute correctly: use it
 * alongside whatever mileage log/ELD export you already keep, not as a
 * complete return on its own.
 */
export default async function IftaPage({
  searchParams,
}: {
  searchParams: { year?: string; quarter?: string };
}) {
  const { supabase } = await requireProfile();

  const now = new Date();
  const year = Number(searchParams.year) || now.getUTCFullYear();
  const quarter = Number(searchParams.quarter) || Math.floor(now.getUTCMonth() / 3) + 1;

  const startMonth = (quarter - 1) * 3; // 0-indexed
  const rangeStart = new Date(Date.UTC(year, startMonth, 1)).toISOString().slice(0, 10);
  const rangeEnd = new Date(Date.UTC(year, startMonth + 3, 1)).toISOString().slice(0, 10);

  const { data: purchases } = await supabase
    .from("fuel_purchases")
    .select("jurisdiction, gallons, total_amount")
    .gte("purchase_date", rangeStart)
    .lt("purchase_date", rangeEnd);

  const byJurisdiction = new Map<string, { gallons: number; amount: number; count: number }>();
  for (const p of purchases ?? []) {
    const existing = byJurisdiction.get(p.jurisdiction) ?? { gallons: 0, amount: 0, count: 0 };
    existing.gallons += Number(p.gallons);
    existing.amount += Number(p.total_amount);
    existing.count += 1;
    byJurisdiction.set(p.jurisdiction, existing);
  }
  const rows = Array.from(byJurisdiction.entries())
    .map(([jurisdiction, totals]) => ({ jurisdiction, ...totals }))
    .sort((a, b) => b.gallons - a.gallons);

  const grandGallons = rows.reduce((sum, r) => sum + r.gallons, 0);
  const grandAmount = rows.reduce((sum, r) => sum + r.amount, 0);

  const csvRows: IftaCsvRow[] = rows.map((r) => ({
    jurisdiction: r.jurisdiction,
    jurisdiction_name: JURISDICTION_NAME[r.jurisdiction] ?? r.jurisdiction,
    gallons: r.gallons,
    amount: r.amount,
    purchase_count: r.count,
  }));

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">IFTA</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Fuel purchases by jurisdiction, by quarter — report
            generation, not e-filing.
          </p>
        </div>
        <DownloadIftaCsvButton rows={csvRows} year={year} quarter={quarter} />
      </div>

      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
        This covers gallons purchased per jurisdiction only — a
        complete IFTA return also needs miles driven per jurisdiction,
        which this app doesn&apos;t track yet. Use this alongside your
        mileage log or ELD export, not as a standalone filing.
      </div>

      <div className="mt-4">
        <QuarterPicker year={year} quarter={quarter} />
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {rows.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
            No fuel purchases logged for Q{quarter} {year}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Jurisdiction</th>
                  <th className="px-6 py-3 font-medium">Gallons</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Purchases</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.jurisdiction} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {JURISDICTION_NAME[r.jurisdiction] ?? r.jurisdiction} ({r.jurisdiction})
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {r.gallons.toFixed(3)}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      ${r.amount.toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{r.count}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50 font-medium text-slate-900 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-100">
                <tr>
                  <td className="px-6 py-3">Total</td>
                  <td className="px-6 py-3">{grandGallons.toFixed(3)}</td>
                  <td className="px-6 py-3">${grandAmount.toFixed(2)}</td>
                  <td className="px-6 py-3">
                    {rows.reduce((sum, r) => sum + r.count, 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
