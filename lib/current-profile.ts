import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Every authenticated page needs the same three things: a logged-in user
 * (or a bounce to /login), that user's profile row, and their company
 * name for the header. Pulled out of dashboard/page.tsx so Drivers,
 * Loads, and Payroll don't each re-implement the same lookup.
 *
 * Wrapped in React's cache() because app/dashboard/layout.tsx calls this
 * to build the shell, and the page it's wrapping calls it again for its
 * own data — cache() dedupes those into a single auth + profile round
 * trip per request instead of two.
 */
export const requireProfile = cache(async function requireProfile() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // RLS scopes this to the caller's own row automatically — no company_id
  // filter needed here, the database enforces it.
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, company_id, theme_preference, companies ( name )")
    .eq("id", user.id)
    .single();

  const companyName =
    (profile?.companies as unknown as { name: string } | null)?.name ?? null;

  // Deliberately a separate query from the one above, not one more
  // embedded column on it: every other page in this app depends on
  // `profile` coming back non-null, and a single bad/missing column
  // anywhere in one combined select fails the WHOLE query — logo lookup
  // failing (migration not run yet, RLS hiccup, whatever) must never be
  // able to take `profile` down with it. Caught exactly this live: with
  // `logo_updated_at` embedded in the query above before this was split
  // out, every /dashboard/* page 500'd the moment that column didn't
  // exist yet in a database that hadn't run the migration.
  let logoUrl: string | null = null;
  if (profile?.company_id) {
    const { data: logoCompany } = await supabase
      .from("companies")
      .select("logo_updated_at")
      .eq("id", profile.company_id)
      .single();

    // getPublicUrl() is pure string-building, no network call.
    // logo_updated_at doubles as a cache-busting query param, since
    // every re-upload overwrites the same object path (see
    // CompanyLogoUpload.tsx).
    if (logoCompany?.logo_updated_at) {
      logoUrl = `${
        supabase.storage
          .from("company-logos")
          .getPublicUrl(`${profile.company_id}/logo`).data.publicUrl
      }?t=${encodeURIComponent(logoCompany.logo_updated_at)}`;
    }
  }

  return { supabase, user, profile, companyName, logoUrl };
});
