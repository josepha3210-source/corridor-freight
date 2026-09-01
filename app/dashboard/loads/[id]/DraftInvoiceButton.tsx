"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createInvoice, PAYMENT_TERMS_DAYS } from "@/lib/create-invoice";

/**
 * POD-triggered invoicing (v2 prompt Phase 7) — right where a
 * dispatcher already sees "this load was just delivered," offer to
 * draft the customer invoice instead of sending them over to the
 * Invoicing page to start one from scratch. This calls the exact same
 * createInvoice() RPC the Invoicing page's own form uses, with this
 * one load pre-selected — nothing new on the create side, just a
 * shortcut into it from the moment that actually prompts it.
 *
 * "Offer to draft — never auto-send" per the prompt's own framing:
 * create_invoice_with_line_items() (0018) always creates the invoice
 * as status='draft' regardless of caller, and this button only ever
 * fires on an explicit click, never automatically off the delivery
 * event itself. It redirects to the new invoice's own detail page
 * afterward so a person reviews (and edits, if needed) before any
 * separate, explicit "mark as sent" action.
 */
export function DraftInvoiceButton({
  loadId,
  customerId,
  companyId,
  paymentTerms,
}: {
  loadId: string;
  customerId: string;
  companyId: string;
  paymentTerms: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    const days = paymentTerms ? PAYMENT_TERMS_DAYS[paymentTerms] : null;
    const dueAt = days ? addDays(new Date(), days) : null;

    const { data: invoiceId, error: rpcError } = await createInvoice(supabase, {
      companyId,
      customerId,
      loadIds: [loadId],
      dueAt,
    });

    setLoading(false);

    if (rpcError || !invoiceId) {
      setError(rpcError?.message ?? "Could not create the invoice.");
      return;
    }

    router.push(`/dashboard/invoicing/${invoiceId}`);
  }

  return (
    <div className="mt-4">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Drafting…" : "Draft customer invoice"}
      </button>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Creates a draft you can review and edit — this never sends
        anything to the customer on its own.
      </p>
      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function addDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result.toISOString().slice(0, 10);
}
