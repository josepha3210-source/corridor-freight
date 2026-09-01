import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Same rule as the drivers_full_name_has_first_and_last DB constraint
 * (0013) — first and last name, 2+ characters each. That constraint is
 * the actual enforcement (a client check alone let "m" through and it
 * propagated everywhere); this is purely so a form can reject it inline
 * before round-tripping to the server just to get the same answer back.
 */
export function isValidDriverName(name: string): boolean {
  return /^\S{2,}(\s+\S{2,})+$/.test(name.trim());
}

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
