import { requireProfile } from "@/lib/current-profile";
import { AddHvutFilingForm } from "./AddHvutFilingForm";
import { HvutStatusActions } from "./HvutStatusActions";

const STATUS_CLASSES: Record<string, string> = {
  not_filed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  filed: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  paid: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
};

/**
 * Real page (Phase 5d) — was a ComingSoon placeholder, but this is a
 * stub in substance, not just presentation: no e-filing (needs an
 * authorized IRS e-file provider integration, not built), and no
 * auto-computed tax amount (Form 2290's Tax Computation Table is real,
 * but its exact current-year dollar figures couldn't be confirmed
 * against a live source while building this — entering a possibly-
 * wrong number as if it were authoritative would be worse than not
 * computing one). Same honest-placeholder shape as 0011's Stripe price
 * IDs: real columns for what a filing needs, genuinely incomplete on
 * the two pieces that need real-world resources this build doesn't have.
 */
export default async function HvutPage() {
  const { profile, supabase } = await requireProfile();

  const [{ data: filings }, { data: trucks }] = await Promise.all([
    supabase
      .from("hvut_filings")
      .select(
        "id, tax_year, weight_category, first_used_month, tax_amount, filing_status, filed_at, schedule_1_received, trucks ( plate_number )"
      )
      .order("tax_year", { ascending: false }),
    supabase.from("trucks").select("id, plate_number").eq("status", "active").order("plate_number"),
  ]);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">HVUT Form 2290</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Track which trucks have Heavy Vehicle Use Tax filed for
            which tax year.
          </p>
        </div>
        {profile?.company_id && (
          <AddHvutFilingForm companyId={profile.company_id} trucks={trucks ?? []} />
        )}
      </div>

      <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
        This tracks filing status only — it doesn&apos;t e-file with the
        IRS (that needs an authorized e-file provider) or compute your
        tax amount for you (enter it from your current Form 2290
        instructions or preparer).
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {!filings || filings.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
            No filings tracked yet. Add one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Truck</th>
                  <th className="px-6 py-3 font-medium">Tax year</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Tax amount</th>
                  <th className="px-6 py-3 font-medium">Schedule 1</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filings.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {(f.trucks as unknown as { plate_number: string } | null)?.plate_number ?? "—"}
                    </td>
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {f.tax_year}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{f.weight_category}</td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {f.tax_amount != null ? `$${Number(f.tax_amount).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {f.schedule_1_received ? "Received" : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[f.filing_status]}`}>
                        {f.filing_status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <HvutStatusActions
                        filingId={f.id}
                        status={f.filing_status}
                        scheduleOneReceived={f.schedule_1_received}
                      />
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
