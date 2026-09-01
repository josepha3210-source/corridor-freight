import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/current-profile";
import { InvoiceDetailClient, type Invoice } from "./InvoiceDetailClient";

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, companyName } = await requireProfile();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, status, issued_at, due_at, notes, contacts ( name, contact_email, billing_address ), invoice_line_items ( id, description, amount )"
    )
    .eq("id", params.id)
    .single();

  if (!invoice) {
    notFound();
  }

  return (
    <>
      <Link
        href="/dashboard/invoicing"
        className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
      >
        ← All invoices
      </Link>

      <div className="mt-4">
        <InvoiceDetailClient
          invoice={invoice as unknown as Invoice}
          companyName={companyName ?? "Your company"}
        />
      </div>
    </>
  );
}
