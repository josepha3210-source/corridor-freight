import type { SupabaseClient } from "@supabase/supabase-js";

/** net_15/30/45/60 → number of days, for defaulting an invoice's due date. */
export const PAYMENT_TERMS_DAYS: Record<string, number> = {
  net_15: 15,
  net_30: 30,
  net_45: 45,
  net_60: 60,
};

/**
 * The one place an invoice gets created — one call inserts the invoice
 * and every line item (one per delivered load, plus an optional
 * freeform extra line) via create_invoice_with_line_items() (0018), so
 * an invoice is never left with some of its lines missing.
 */
export async function createInvoice(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    customerId: string;
    loadIds: string[];
    dueAt: string | null;
    extraDescription?: string | null;
    extraAmount?: number | null;
  }
) {
  return supabase.rpc("create_invoice_with_line_items", {
    p_company_id: input.companyId,
    p_customer_id: input.customerId,
    p_load_ids: input.loadIds,
    p_due_at: input.dueAt,
    p_extra_description: input.extraDescription || null,
    p_extra_amount: input.extraAmount ?? null,
  });
}
