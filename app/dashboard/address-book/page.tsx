import { requireProfile } from "@/lib/current-profile";
import { AddContactForm } from "@/components/AddContactForm";

const TYPE_LABEL: Record<string, string> = {
  vendor: "Vendor",
  broker: "Broker",
  factoring: "Factoring",
  carrier: "Carrier",
};

/**
 * Real page now (Phase 3b) — was a ComingSoon placeholder in Phase 1.
 * Everyone in `contacts` (0016) except customers — same table, same
 * form component as Customers, different type filter.
 */
export default async function AddressBookPage() {
  const { profile, supabase } = await requireProfile();

  const { data: contacts } = await supabase
    .from("contacts")
    .select("id, type, name, contact_name, contact_email, contact_phone, status")
    .neq("type", "customer")
    .order("name");

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Address Book
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Vendors, brokers, factoring companies, and other carriers.
          </p>
        </div>
        {profile?.company_id && (
          <AddContactForm
            companyId={profile.company_id}
            typeOptions={[
              { value: "vendor", label: "Vendor" },
              { value: "broker", label: "Broker" },
              { value: "factoring", label: "Factoring" },
              { value: "carrier", label: "Carrier" },
            ]}
            buttonLabel="+ Add contact"
          />
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {!contacts || contacts.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
            No contacts yet. Add your first one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Type</th>
                  <th className="px-6 py-3 font-medium">Contact</th>
                  <th className="px-6 py-3 font-medium">Email</th>
                  <th className="px-6 py-3 font-medium">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {contacts.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                      {c.name}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {TYPE_LABEL[c.type] ?? c.type}
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
