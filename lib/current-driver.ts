import { cache } from "react";
import { redirect } from "next/navigation";
import { requireProfile } from "./current-profile";

/**
 * The driver-portal equivalent of requireProfile() — same auth/profile
 * lookup, plus the linked drivers row every /driver/* page needs (their
 * assigned loads are found via drivers.id, not auth.uid() directly).
 *
 * `driver` can come back null if a profile has role='driver' but no
 * drivers row points user_id at it yet — shouldn't happen through the
 * normal invite flow (handle_new_user links them atomically), but
 * callers render an inline message for that case rather than assuming
 * it can't happen. Deliberately NOT a redirect on that path: this user
 * is genuinely authenticated with role='driver', so bouncing them to
 * /login would just send them right back here through middleware and
 * loop.
 */
export const requireDriver = cache(async function requireDriver() {
  const { supabase, user, profile, companyName, logoUrl } = await requireProfile();

  if (profile?.role !== "driver") {
    redirect("/dashboard");
  }

  const { data: driver } = await supabase
    .from("drivers")
    .select("id, full_name, phone, email, status")
    .eq("user_id", user.id)
    .single();

  return { supabase, user, profile, companyName, logoUrl, driver };
});
