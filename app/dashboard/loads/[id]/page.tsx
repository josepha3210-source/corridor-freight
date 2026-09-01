import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/current-profile";
import { isGoogleMapsConfigured } from "@/lib/google-maps";
import { LoadDetailClient } from "./LoadDetailClient";

export default async function LoadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, logoUrl } = await requireProfile();

  // RLS's "select own company loads"/dispatches policies mean this
  // simply returns no row (not another tenant's data) if the id belongs
  // to a different company — notFound() below covers both "doesn't
  // exist" and "not yours" with the same response.
  //
  // loads_with_dispatch (0017) — dispatch_id is the id every write on
  // this page (status changes, delivery confirmation) actually targets
  // now; `id` stays the load's own id, used for routing only.
  const { data: load } = await supabase
    .from("loads_with_dispatch")
    .select(
      "id, dispatch_id, load_number, client_name, pickup_location, pickup_at, dropoff_location, dropoff_at, status, client_rate, driver_pay, miles, driver_id, driver_name, truck_id, truck_plate, signed_by_name, signature_data, delivered_at, notes"
    )
    .eq("id", params.id)
    .single();

  if (!load) {
    notFound();
  }

  const driverName = load.driver_name ?? null;

  // Every driver, not just active ones — an inactive driver still needs
  // to appear as the selected option if they're the one already assigned
  // to this load, so opening Edit doesn't visually blank the selection.
  // LoadDetailClient itself narrows this to "active, or currently
  // assigned" when building the dropdown's options. Same reasoning for
  // trucks — a truck's current assignment shouldn't visually disappear
  // just because it's since gone inactive.
  const [{ data: drivers }, { data: trucks }] = await Promise.all([
    supabase.from("drivers").select("id, full_name, status").order("full_name"),
    supabase.from("trucks").select("id, plate_number, status").order("plate_number"),
  ]);

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
          trucks={trucks ?? []}
          companyLogoUrl={logoUrl}
          mileageEnabled={isGoogleMapsConfigured()}
        />
      </div>
    </>
  );
}
