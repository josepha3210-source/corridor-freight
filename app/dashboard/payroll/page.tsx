import Link from "next/link";
import { requireProfile } from "@/lib/current-profile";
import { CreatePaymentButton } from "./CreatePaymentButton";
import { MarkPaidButton } from "./MarkPaidButton";
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

/**
 * Every row on this page traces back to a delivered load: "Awaiting
 * payment" is delivered loads with no payment yet, and the per-driver
 * statements below are just those payments once they exist. Nothing here
 * creates a payment automatically — that's a deliberate choice made back
 * in the Loads work, so marking a load delivered never silently commits
 * to a payroll number without a person confirming it.
 */
export default async function PayrollPage() {
  const { supabase, profile } = await requireProfile();

  const [{ data: deliveredLoads }, { data: paymentsData }] =
    await Promise.all([
      supabase
        .from("loads")
        .select(
          "id, load_number, client_name, driver_id, driver_pay, drivers ( full_name )"
        )
        .eq("status", "delivered")
        .order("delivered_at", { ascending: false }),
      supabase
        .from("payments")
        .select(
          "id, amount, status, paid_at, driver_id, load_id, drivers ( full_name ), loads ( load_number, client_name )"
        )
        .order("created_at", { ascending: false }),
    ]);

  const payments = (paymentsData ?? []) as unknown as PaymentRow[];
  const paidLoadIds = new Set(payments.map((p) => p.load_id));
  const awaitingPayment = (deliveredLoads ?? []).filter(
    (load) => load.driver_id && !paidLoadIds.has(load.id)
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
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Payroll</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Create a payment once a load&apos;s delivered, mark it paid once
            it&apos;s sent.
          </p>
        </div>
        <DownloadPayrollCsvButton rows={csvRows} />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Awaiting payment
        </h2>
        {awaitingPayment.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            Every delivered load has a payment queued.
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
                  <th className="px-6 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {awaitingPayment.map((load) => (
                  <tr key={load.id}>
                    <td className="px-6 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                      {load.load_number}
                    </td>
                    <td className="px-6 py-3 text-slate-900 dark:text-slate-100">
                      {load.client_name}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      {(load.drivers as unknown as { full_name: string } | null)
                        ?.full_name ?? "—"}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-400">
                      ${Number(load.driver_pay).toFixed(2)}
                    </td>
                    <td className="px-6 py-3">
                      {profile?.company_id && load.driver_id && (
                        <CreatePaymentButton
                          companyId={profile.company_id}
                          loadId={load.id}
                          driverId={load.driver_id}
                          driverPay={Number(load.driver_pay)}
                        />
                      )}
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
          Per-driver statements
        </h2>
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
