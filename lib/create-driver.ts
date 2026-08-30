import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The one place a drivers row gets created — used by AddDriverForm (the
 * Drivers page, browser client, RLS enforces tenant isolation) and the
 * Settings invite route's driver branch (server client, same RLS
 * policy still applies since neither caller is service-role). Extracted
 * so both call sites can never drift into inserting a different shape.
 */
export async function createDriver(
  supabase: SupabaseClient,
  input: {
    companyId: string;
    fullName: string;
    phone?: string | null;
    email?: string | null;
  }
) {
  return supabase
    .from("drivers")
    .insert({
      company_id: input.companyId,
      full_name: input.fullName,
      phone: input.phone || null,
      email: input.email || null,
    })
    .select()
    .single();
}
