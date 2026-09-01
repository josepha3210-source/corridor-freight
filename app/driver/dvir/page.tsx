import Link from "next/link";
import { requireDriver } from "@/lib/current-driver";
import { DvirForm } from "./DvirForm";

/**
 * Driver-facing DVIR submission — the "DVIR prompt" the Phase 1 driver
 * dashboard rebuild always intended to link to (ROADMAP §78), filled in
 * now that dvir_reports exists (0021).
 */
export default async function DriverDvirPage() {
  const { supabase, driver, profile } = await requireDriver();
  if (!driver || !profile?.company_id) return null;

  const { data: trucks } = await supabase
    .from("trucks")
    .select("id, plate_number, make, model")
    .eq("status", "active")
    .order("plate_number");

  return (
    <>
      <Link
        href="/driver"
        className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
      >
        ← My loads
      </Link>

      <div className="mt-4">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Vehicle inspection (DVIR)
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Required before and after each duty day — check every item,
          note any defects, and sign.
        </p>

        <div className="mt-4">
          <DvirForm companyId={profile.company_id} driverId={driver.id} trucks={trucks ?? []} />
        </div>
      </div>
    </>
  );
}
