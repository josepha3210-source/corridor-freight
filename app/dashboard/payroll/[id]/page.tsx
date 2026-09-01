import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/current-profile";
import { SettlementDetailClient, type Settlement } from "./SettlementDetailClient";

export default async function SettlementDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { supabase, companyName } = await requireProfile();

  const { data: settlement } = await supabase
    .from("settlements")
    .select(
      "id, status, created_at, paid_at, notes, driver_id, drivers ( full_name ), settlement_line_items ( id, line_type, description, amount )"
    )
    .eq("id", params.id)
    .single();

  if (!settlement) {
    notFound();
  }

  return (
    <>
      <Link
        href="/dashboard/payroll"
        className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
      >
        ← All settlements
      </Link>

      <div className="mt-4">
        <SettlementDetailClient
          settlement={settlement as unknown as Settlement}
          companyName={companyName ?? "Your company"}
        />
      </div>
    </>
  );
}
