import Link from "next/link";
import { requireProfile } from "@/lib/current-profile";
import { CreateInvoiceForm } from "./CreateInvoiceForm";

const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  sent: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  paid: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  void: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

/**
 * Real page (Phase 4a) — was a ComingSoon placeholder in Phase 1.
 * `total` is never a stored column (0018's own comment: same "derived,
 * never written" reasoning as loads' margin) — it's the embedded
 * invoice_line_items(amount) summed here, so it can't drift from the
 * line items it's built from.
 */
export default async function InvoicingPage() {
  const { profile, supabase } = await requireProfile();

  const [{ data: invoices }, { data: customers }, { data: deliveredLoads }] =
    await Promise.all([
      supabase
        .from("invoices")
        .select(
          "id, invoice_number, status, issued_at, due_at, contacts ( name ), invoice_line_items ( amount )"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("contacts")
        .select("id, name, payment_terms")
        .eq("type", "customer")
        .eq("status", "active")
        .order("name"),
      // Every delivered load with its customer — CreateInvoiceForm
      // narrows this down to "delivered, this customer, not already on
      // a live invoice" once a customer's picked.
      supabase
        .from("loads_with_dispatch")
        .select("id, load_number, client_name, client_rate, customer_id")
        .eq("status", "delivered")
        .not("customer_id", "is", null),
    ]);

  const invoicedLoadIdsQuery = await supabase
    .from("invoice_line_items")
    .select("load_id, invoices ( status )")
    .not("load_id", "is", null);

  const invoicedLoadIds = new Set(
    (invoicedLoadIdsQuery.data ?? [])
      .filter((li) => (li.invoices as unknown as { status: string } | null)?.status !== "void")
      .map((li) => li.load_id as string)
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Invoicing
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Bill customers for delivered loads — base rate plus any
            accessorials as extra line items.
          </p>
        </div>
        {profile?.company_id && (
          <CreateInvoiceForm
            companyId={profile.company_id}
            customers={customers ?? []}
            deliveredLoads={(deliveredLoads ?? []).filter(
              (l) => !invoicedLoadIds.has(l.id)
            )}
          />
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {!invoices || invoices.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-600 dark:text-slate-400">
            No invoices yet. Create one from a delivered load above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Invoice #</th>
                  <th className="px-6 py-3 font-medium">Customer</th>
                  <th className="px-6 py-3 font-medium">Issued</th>
                  <th className="px-6 py-3 font-medium">Due</th>
                  <th className="px-6 py-3 font-medium">Total</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoices.map((inv) => {
                  const total = (
                    (inv.invoice_line_items as unknown as { amount: number }[]) ?? []
                  ).reduce((sum, li) => sum + Number(li.amount), 0);
                  const customerName =
                    (inv.contacts as unknown as { name: string } | null)?.name ?? "—";
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                        <Link href={`/dashboard/invoicing/${inv.id}`} className="hover:underline">
                          {inv.invoice_number}
                        </Link>
                      </td>
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                        {customerName}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {inv.issued_at}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {inv.due_at ?? "—"}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        ${total.toFixed(2)}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            STATUS_CLASSES[inv.status] ?? STATUS_CLASSES.draft
                          }`}
                        >
                          {inv.status}
                        </span>
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
