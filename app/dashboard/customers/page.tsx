import { requireProfile } from "@/lib/current-profile";
import { AddContactForm } from "@/components/AddContactForm";

const TERMS_LABEL: Record<string, string> = {
  net_15: "Net 15",
  net_30: "Net 30",
  net_45: "Net 45",
  net_60: "Net 60",
};

/**
 * Real page now (Phase 3b) — was a ComingSoon placeholder in Phase 1.
 * `contacts` where type = 'customer' (0016) — the same table Address
 * Book reads from with a different filter, not a separate table.
 * Existing loads' free-text client names were backfilled into this
 * table by the migration itself (exact-match only); this list is also
 * where duplicates/typos from that backfill get manually merged, per
 * the migration's own comment.
 */
export default async function CustomersPage() {
  const { profile, supabase } = await requireProfile();

  const { data: customers } = await supabase
    .from("contacts")
    .select("id, name, contact_name, contact_email, contact_phone, payment_terms, status")
    .eq("type", "customer")
    .order("name");

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Customers
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Real customer records — replaces free-text client names on a
            load.
          </p>
        </div>
        {profile?.company_id && (
          <AddContactForm
            companyId={profile.company_id}
            fixedType="customer"
            buttonLabel="+ Add customer"
          />
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {!customers || customers.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
            No customers yet. Add your first one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Phone</th>
                  <th className="px-6 py-3 font-medium">Terms</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {c.name}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {c.contact_name || "—"}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {c.contact_email || "—"}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {c.contact_phone || "—"}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {c.payment_terms ? TERMS_LABEL[c.payment_terms] ?? c.payment_terms : "—"}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          c.status === "active"
                            ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}
                      >
                        {c.status}
                      </span>
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
