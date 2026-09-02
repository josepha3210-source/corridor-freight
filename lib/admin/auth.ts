import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Access control for the platform-admin dashboard (/admin) — the
 * cross-tenant operator view (ROADMAP §101).
 *
 * This is deliberately NOT built on `profiles.role`. In this schema
 * `role` ('owner' | 'dispatcher' | 'driver' | 'admin') is always scoped
 * to one company via RLS and `current_company_id()` — an "owner" there
 * owns one tenant, which is a different concept from "operator of the
 * whole platform." A single env var (`ADMIN_EMAILS`) is the entire gate
 * for v1: one trusted person, no new table, no new RLS surface. If a
 * multi-admin story is ever needed, a `platform_admins` table keyed by
 * email or user_id is the natural upgrade (see ROADMAP §101).
 *
 * This module imports `@/lib/supabase/server` (which pulls in
 * `next/headers`), so it can only ever be used from Server Components
 * and Route Handlers — it can't be bundled into client code even by
 * accident.
 */

/** Parsed, normalized all-list from the ADMIN_EMAILS env var. */
export function parseAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/** Exact, case-insensitive membership check. Empty/absent env → nobody. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return parseAdminEmails().includes(email.trim().toLowerCase());
}

/**
 * Call at the very top of every /admin server component (and the
 * layout). Re-fetches the current user via the NORMAL, cookie-scoped
 * client — never the service-role one — and bounces anyone who isn't on
 * the list to /login rather than a 403, so the route's existence is
 * never confirmed to someone who shouldn't see it. Done per-page, not
 * only in the layout, so a direct link to any sub-page is checked on
 * its own.
 */
export async function requirePlatformAdmin(): Promise<{ user: User }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email)) {
    redirect("/login");
  }

  return { user };
}
