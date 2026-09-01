"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { InvoicePdfButton } from "./InvoicePdfButton";
import { InvoiceCsvButton } from "./InvoiceCsvButton";

type LineItem = { id: string; description: string; amount: number };

export type Invoice = {
  id: string;
  invoice_number: string;
  status: "draft" | "sent" | "paid" | "void";
  issued_at: string;
  due_at: string | null;
  notes: string | null;
  contacts: { name: string; contact_email: string | null; billing_address: string | null } | null;
  invoice_line_items: LineItem[];
};

const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  sent: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  paid: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  void: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

export function InvoiceDetailClient({
  invoice,
  companyName,
}: {
  invoice: Invoice;
  companyName: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineItems = invoice.invoice_line_items ?? [];
  const total = lineItems.reduce((sum, li) => sum + Number(li.amount), 0);
  const customerName = invoice.contacts?.name ?? "—";
  const isTerminal = invoice.status === "paid" || invoice.status === "void";

  async function setStatus(status: string) {
    setError(null);
    setLoading(true);
    const { error: updateError } = await supabase
      .from("invoices")
      .update({ status })
      .eq("id", invoice.id);
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
              {invoice.invoice_number}
            </p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {customerName}
            </h2>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              STATUS_CLASSES[invoice.status]
            }`}
          >
            {invoice.status}
          </span>
        </div>

        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Issued</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
              {invoice.issued_at}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Due</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
              {invoice.due_at ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Total</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
              ${total.toFixed(2)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 overflow-hidden rounded-md border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lineItems.map((li) => (
                <tr key={li.id}>
                  <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{li.description}</td>
                  <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">
                    ${Number(li.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {invoice.notes && (
          <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {invoice.notes}
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <InvoicePdfButton
            data={{
              invoiceNumber: invoice.invoice_number,
              companyName,
              customerName,
              customerEmail: invoice.contacts?.contact_email ?? null,
              billingAddress: invoice.contacts?.billing_address ?? null,
              issuedAt: invoice.issued_at,
              dueAt: invoice.due_at,
              notes: invoice.notes,
              lineItems: lineItems.map((li) => ({
                description: li.description,
                amount: Number(li.amount),
              })),
            }}
          />
          <InvoiceCsvButton
            invoiceNumber={invoice.invoice_number}
            customerName={customerName}
            issuedAt={invoice.issued_at}
            dueAt={invoice.due_at}
            lineItems={lineItems.map((li) => ({
              description: li.description,
              amount: Number(li.amount),
            }))}
          />
        </div>
      </div>

      {!isTerminal && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Status</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            {invoice.status === "draft" && (
              <button
                onClick={() => setStatus("sent")}
                disabled={loading}
                className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                Mark sent
              </button>
            )}
            {invoice.status === "sent" && (
              <button
                onClick={() => setStatus("paid")}
                disabled={loading}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
              >
                Mark paid
              </button>
            )}
            <button
              onClick={() => setStatus("void")}
              disabled={loading}
              className="rounded-md px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              Void
            </button>
          </div>
          {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
