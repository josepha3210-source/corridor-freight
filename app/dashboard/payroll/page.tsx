import Link from "next/link";
import { requireProfile } from "@/lib/current-profile";
import { MarkPaidButton } from "./MarkPaidButton";
import { CreateSettlementForm } from "./CreateSettlementForm";
import { RecordAdvanceForm } from "./RecordAdvanceForm";
import {
  DownloadPayrollCsvButton,
  type PayrollCsvRow,
} from "./DownloadPayrollCsvButton";

type PaymentRow = {
  id: string;
  amount: number;
  status: "pending" | "paid";
  paid_at: string | null;
  driver_id: string;
  load_id: string;
  drivers: { full_name: string } | null;
  loads: { load_number: string; client_name: string } | null;
};

type DriverGroup = {
  driverId: string;
  driverName: string;
  pendingTotal: number;
  paidTotal: number;
  payments: PaymentRow[];
};

const SETTLEMENT_STATUS_CLASSES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  paid: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  void: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

/**
 * Real Settlements (Phase 4b) replaced flat "mark paid" as of 0019 —
 * see lib/create-settlement.ts and CreateSettlementForm for the pay-
 * method math. The old `payments` table (0001) is untouched and still
 * shown below as "Payment history" — every row in it is already real,
 * paid money, not something to migrate. A delivered load can only ever
 * be claimed by one mechanism: "Awaiting settlement" below excludes
 * loads that already have either an old-style payment OR a settlement
 * line item, so nothing can be double-paid.
 */
export default async function PayrollPage() {
  const { supabase, profile } = await requireProfile();

  const [
    { data: deliveredLoads },
    { data: paymentsData },
    { data: drivers },
    { data: settlements },
    { data: settledLineItems },
    { data: advances },
  ] = await Promise.all([
    supabase
      .from("loads_with_dispatch")
      .select("id, load_number, client_name, client_rate, driver_id, driver_pay, driver_name, miles")
      .eq("status", "delivered")
      .order("delivered_at", { ascending: false }),
    supabase
      .from("payments")
      .select(
        "id, amount, status, paid_at, driver_id, load_id, drivers ( full_name ), loads ( load_number, client_name )"
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("drivers")
      .select("id, full_name, pay_type, pay_rate")
      .eq("status", "active")
      .order("full_name"),
    supabase
      .from("settlements")
      .select(
        "id, status, created_at, paid_at, drivers ( full_name ), settlement_line_items ( line_type, amount )"
      )
      .order("created_at", { ascending: false }),
    supabase.from("settlement_line_items").select("load_id").not("load_id", "is", null),
    supabase
      .from("driver_advances")
      .select("id, driver_id, amount, reason, created_at, drivers ( full_name )")
      .eq("status", "outstanding")
      .order("created_at", { ascending: false }),
  ]);

  const payments = (paymentsData ?? []) as unknown as PaymentRow[];
  const paidLoadIds = new Set(payments.map((p) => p.load_id));
  const settledLoadIds = new Set((settledLineItems ?? []).map((li) => li.load_id as string));

  const awaitingSettlement = (deliveredLoads ?? []).filter(
    (load) => load.driver_id && !paidLoadIds.has(load.id) && !settledLoadIds.has(load.id)
  );

  const driverGroups = new Map<string, DriverGroup>();
  for (const p of payments) {
    const driverName = p.drivers?.full_name ?? "Unknown driver";
    if (!driverGroups.has(p.driver_id)) {
      driverGroups.set(p.driver_id, {
        driverId: p.driver_id,
        driverName,
        pendingTotal: 0,
        paidTotal: 0,
        payments: [],
      });
    }
    const group = driverGroups.get(p.driver_id)!;
    group.payments.push(p);
    if (p.status === "pending") group.pendingTotal += Number(p.amount);
    else group.paidTotal += Number(p.amount);
  }
  const sortedGroups = Array.from(driverGroups.values()).sort((a, b) =>
    a.driverName.localeCompare(b.driverName)
  );

  const csvRows: PayrollCsvRow[] = payments.map((p) => ({
    driver_name: p.drivers?.full_name ?? "Unknown driver",
    load_number: p.loads?.load_number ?? "",
    client_name: p.loads?.client_name ?? "",
    amount: Number(p.amount),
    status: p.status,
    paid_at: p.paid_at ? new Date(p.paid_at).toISOString() : "",
  }));

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Settlements</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Pay a driver from their delivered loads — computed by their
            pay method, plus any deductions, reimbursements, and
            advances.
          </p>
        </div>
        <div className="flex gap-3">
          <DownloadPayrollCsvButton rows={csvRows} />
          {profile?.company_id && (
            <CreateSettlementForm
              companyId={profile.company_id}
              drivers={drivers ?? []}
              deliveredLoads={awaitingSettlement}
              advances={advances ?? []}
            />
          )}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Awaiting settlement
        </h2>
        {awaitingSettlement.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Every delivered load is on a settlement or payment already.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Load #</th>
                  <th className="px-6 py-3 font-medium">Client</th>
                  <th className="px-6 py-3 font-medium">Driver</th>
                  <th className="px-6 py-3 font-medium">Driver pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {awaitingSettlement.map((load) => (
                  <tr key={load.id}>
                    <td className="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {load.load_number}
                    </td>
                    <td className="px-6 py-3 text-slate-900 dark:text-slate-100">
                      {load.client_name}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {load.driver_name ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      ${Number(load.driver_pay).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Settlements
        </h2>
        {!settlements || settlements.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            No settlements yet. Create one from a delivered load above.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Driver</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 font-medium">Net</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {settlements.map((s) => {
                  const lineItems =
                    (s.settlement_line_items as unknown as { line_type: string; amount: number }[]) ??
                    [];
                  const net = lineItems.reduce((sum, li) => {
                    const signed =
                      li.line_type === "deduction" || li.line_type === "advance_repayment"
                        ? -Number(li.amount)
                        : Number(li.amount);
                    return sum + signed;
                  }, 0);
                  const driverName =
                    (s.drivers as unknown as { full_name: string } | null)?.full_name ?? "—";
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                      <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                        <Link href={`/dashboard/payroll/${s.id}`} className="hover:underline">
                          {driverName}
                        </Link>
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                        ${net.toFixed(2)}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            SETTLEMENT_STATUS_CLASSES[s.status] ?? SETTLEMENT_STATUS_CLASSES.draft
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Outstanding advances
          </h2>
          {profile?.company_id && (
            <RecordAdvanceForm companyId={profile.company_id} drivers={drivers ?? []} />
          )}
        </div>
        {!advances || advances.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            No outstanding advances.
          </p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-medium">Driver</th>
                  <th className="px-6 py-3 font-medium">Reason</th>
                  <th className="px-6 py-3 font-medium">Amount</th>
                  <th className="px-6 py-3 font-medium">Given</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {advances.map((a) => (
                  <tr key={a.id}>
                    <td className="px-6 py-3 text-slate-900 dark:text-slate-100">
                      {(a.drivers as unknown as { full_name: string } | null)?.full_name ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {a.reason || "—"}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      ${Number(a.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10 space-y-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Payment history
        </h2>
        <p className="-mt-4 text-xs text-slate-500 dark:text-slate-500">
          From before Settlements — kept for the record, not something
          new payouts go through anymore.
        </p>
        {sortedGroups.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            No payments yet.
          </p>
        ) : (
          sortedGroups.map((group) => (
            <div
              key={group.driverId}
              className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {group.driverName}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Pending:{" "}
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    ${group.pendingTotal.toFixed(2)}
                  </span>
                  {"   ·   "}
                  Paid:{" "}
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    ${group.paidTotal.toFixed(2)}
                  </span>
                </p>
              </div>

              <table className="mt-4 w-full text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <tr>
                    <th className="py-2 font-medium">Load</th>
                    <th className="py-2 font-medium">Amount</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium">Paid at</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {group.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2">
                        <Link
                          href={`/dashboard/loads/${p.load_id}`}
                          className="text-brand-700 hover:underline dark:text-brand-400"
                        >
                          {p.loads?.load_number ?? "Load"}
                          {p.loads?.client_name ? ` — ${p.loads.client_name}` : ""}
                        </Link>
                      </td>
                      <td className="py-2 text-slate-600 dark:text-slate-400">
                        ${Number(p.amount).toFixed(2)}
                      </td>
                      <td className="py-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            p.status === "paid"
                              ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
                              : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-2 text-slate-500 dark:text-slate-400">
                        {p.paid_at
                          ? new Date(p.paid_at).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="py-2">
                        {p.status === "pending" && (
                          <MarkPaidButton paymentId={p.id} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </section>
    </>
  );
}
