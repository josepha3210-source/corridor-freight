import type { SupabaseClient } from "@supabase/supabase-js";

export type ContactType = "customer" | "vendor" | "broker" | "factoring" | "carrier";

/**
 * The one place a contacts row gets created — Customers and Address
 * Book are the same underlying table (0016) filtered by `type`, so both
 * pages' forms go through this one insert rather than each having their
 * own slightly-different version.
 */
export async function createContact(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    type: ContactType;
    name: string;
    contactName?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
    billingAddress?: string | null;
    paymentTerms?: string | null;
    notes?: string | null;
  }
) {
  return supabase
    .from("contacts")
    .insert({
      company_id: input.companyId,
      type: input.type,
      name: input.name,
      contact_name: input.contactName || null,
      contact_email: input.contactEmail || null,
      contact_phone: input.contactPhone || null,
      billing_address: input.billingAddress || null,
      payment_terms: input.paymentTerms || null,
      notes: input.notes || null,
    })
    .select()
    .single();
}
