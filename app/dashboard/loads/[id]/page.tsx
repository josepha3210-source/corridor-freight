import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/current-profile";
import { LoadDetailClient } from "./LoadDetailClient";

export default async function LoadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, logoUrl } = await requireProfile();

  // RLS's "select own company loads" policy means this simply returns no
  // row (not another tenant's data) if the id belongs to a different
  // company — notFound() below covers both "doesn't exist" and "not
  // yours" with the same response.
  //
  // The driver name comes from this embedded join (status-independent),
  // not from looking the id up in the drivers list below — that list is
  // filtered for the assign dropdown, and a load assigned to a driver
  // who's since gone inactive still needs to display their name.
  const { data: load } = await supabase
    .from("loads")
    .select(
      "id, load_number, client_name, pickup_location, pickup_at, dropoff_location, dropoff_at, status, client_rate, driver_pay, driver_id, signed_by_name, signature_data, delivered_at, notes, drivers ( full_name )"
    )
    .eq("id", params.id)
    .single();

  if (!load) {
    notFound();
  }

  const driverName =
    (load.drivers as unknown as { full_name: string } | null)?.full_name ??
    null;

  // Every driver, not just active ones — an inactive driver still needs
  // to appear as the selected option if they're the one already assigned
  // to this load, so opening Edit doesn't visually blank the selection.
  // LoadDetailClient itself narrows this to "active, or currently
  // assigned" when building the dropdown's options.
  const { data: drivers } = await supabase
    .from("drivers")
    .select("id, full_name, status")
    .order("full_name");

  return (
    <>
      <Link
        href="/dashboard/loads"
        className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
      >
        ← All loads
      </Link>

      <div className="mt-4">
        <LoadDetailClient
          load={load}
          driverName={driverName}
          drivers={drivers ?? []}
          companyLogoUrl={logoUrl}
        />
      </div>
    </>
  );
}
