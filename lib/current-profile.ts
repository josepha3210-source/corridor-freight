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
    .select(
      "id, full_name, role, company_id, theme_preference, companies ( name )"
    )
    .eq("id", user.id)
    .single();

  const companyName =
    (profile?.companies as unknown as { name: string } | null)?.name ?? null;

  return { supabase, user, profile, companyName };
});
