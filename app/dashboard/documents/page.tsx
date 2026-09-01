import { requireProfile } from "@/lib/current-profile";
import { UploadDocumentForm } from "./UploadDocumentForm";
import { DocumentRowActions } from "./DocumentRowActions";

const CATEGORY_LABEL: Record<string, string> = {
  driver_license: "Driver license",
  driver_medical_card: "Driver medical card",
  truck_registration: "Truck registration",
  truck_insurance: "Truck insurance",
  company_insurance: "Company insurance",
  other: "Other",
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Real page (Phase 5c) — was a ComingSoon placeholder. Storage-based
 * (private `company-documents` bucket, 0022) — this list is just the
 * metadata; "Download" fetches a short-lived signed URL on click.
 */
export default async function DocumentsPage() {
  const { profile, supabase } = await requireProfile();

  const [{ data: documents }, { data: drivers }, { data: trucks }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, category, title, file_path, expires_at, drivers ( full_name ), trucks ( plate_number )")
      .order("created_at", { ascending: false }),
    supabase.from("drivers").select("id, full_name").eq("status", "active").order("full_name"),
    supabase.from("trucks").select("id, plate_number").eq("status", "active").order("plate_number"),
  ]);

  const soonCutoff = new Date(Date.now() + THIRTY_DAYS_MS).toISOString().slice(0, 10);

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Documents</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Licenses, insurance, and registration — with expiration
            dates that feed the dashboard&apos;s attention panel.
          </p>
        </div>
        {profile?.company_id && (
          <UploadDocumentForm
            companyId={profile.company_id}
            drivers={drivers ?? []}
            trucks={trucks ?? []}
          />
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {!documents || documents.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
            No documents yet. Upload your first one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Title</th>
                  <th className="px-6 py-3 font-medium">Category</th>
                  <th className="px-6 py-3 font-medium">Related to</th>
                  <th className="px-6 py-3 font-medium">Expires</th>
                  <th className="px-6 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {documents.map((d) => {
                  const driverName = (d.drivers as unknown as { full_name: string } | null)?.full_name;
                  const truckPlate = (d.trucks as unknown as { plate_number: string } | null)?.plate_number;
                  const expiringSoon = d.expires_at && d.expires_at <= soonCutoff;
                  return (
                    <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {d.title}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {CATEGORY_LABEL[d.category] ?? d.category}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {driverName || truckPlate || "—"}
                      </td>
                      <td className="px-6 py-3">
                        {d.expires_at ? (
                          <span
                            className={
                              expiringSoon
                                ? "font-medium text-amber-700 dark:text-amber-400"
                                : "text-slate-600 dark:text-slate-400"
                            }
                          >
                            {d.expires_at}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <DocumentRowActions documentId={d.id} filePath={d.file_path} />
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
