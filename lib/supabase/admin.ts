import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses Row Level Security entirely. Only ever
 * import this into server-only code (Route Handlers, Server Components),
 * never into anything that ships to the browser. Constructed lazily
 * (inside the function that needs it) rather than at module load, so a
 * missing key surfaces as a clear error from that one call site instead
 * of crashing the whole server on boot.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (Supabase dashboard → Settings → API → service_role secret) to enable team invites."
    );
  }

  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
