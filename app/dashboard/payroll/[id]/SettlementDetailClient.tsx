"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SettlementPdfButton } from "./SettlementPdfButton";

type LineItem = { id: string; line_type: string; description: string; amount: number };

export type Settlement = {
  id: string;
  status: "draft" | "paid" | "void";
  created_at: string;
  paid_at: string | null;
  notes: string | null;
  driver_id: string;
  drivers: { full_name: string } | null;
  settlement_line_items: LineItem[];
};

const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  paid: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  void: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

const TYPE_LABEL: Record<string, string> = {
  load_pay: "Load pay",
  reimbursement: "Reimbursement",
  deduction: "Deduction",
  advance_repayment: "Advance repayment",
};

export function SettlementDetailClient({
  settlement,
  companyName,
}: {
  settlement: Settlement;
  companyName: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineItems = settlement.settlement_line_items ?? [];
  const net = lineItems.reduce((sum, li) => {
    const signed =
      li.line_type === "deduction" || li.line_type === "advance_repayment"
        ? -Number(li.amount)
        : Number(li.amount);
    return sum + signed;
  }, 0);
  const driverName = settlement.drivers?.full_name ?? "—";
  const isTerminal = settlement.status === "paid" || settlement.status === "void";

  async function setStatus(status: string) {
    setError(null);
    setLoading(true);
    const patch: Record<string, unknown> = { status };
    if (status === "paid") patch.paid_at = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("settlements")
      .update(patch)
      .eq("id", settlement.id);
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{driverName}</h2>
            <Link
              href={`/dashboard/drivers/${settlement.driver_id}`}
              className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-400"
            >
              View driver scorecard →
            </Link>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASSES[settlement.status]}`}>
            {settlement.status}
          </span>
        </div>

        <dl className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Created</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
              {new Date(settlement.created_at).toLocaleDateString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Paid</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
              {settlement.paid_at ? new Date(settlement.paid_at).toLocaleDateString() : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Net</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">
              ${net.toFixed(2)}
            </dd>
          </div>
        </dl>

        <div className="mt-4 overflow-hidden rounded-md border border-slate-200 dark:border-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th className="px-4 py-2 font-medium">Type</th>
                <th className="px-4 py-2 font-medium">Description</th>
                <th className="px-4 py-2 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {lineItems.map((li) => {
                const isNegative = li.line_type === "deduction" || li.line_type === "advance_repayment";
                return (
                  <tr key={li.id}>
                    <td className="px-4 py-2 text-slate-500 dark:text-slate-400">{TYPE_LABEL[li.line_type]}</td>
                    <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{li.description}</td>
                    <td className="px-4 py-2 text-right text-slate-700 dark:text-slate-300">
                      {isNegative ? "-" : ""}${Number(li.amount).toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {settlement.notes && (
          <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {settlement.notes}
          </p>
        )}

        <div className="mt-4">
          <SettlementPdfButton
            data={{
              companyName,
              driverName,
              createdAt: new Date(settlement.created_at).toLocaleDateString(),
              paidAt: settlement.paid_at ? new Date(settlement.paid_at).toLocaleDateString() : null,
              notes: settlement.notes,
              lineItems: lineItems.map((li) => ({
                line_type: li.line_type,
                description: li.description,
                amount: Number(li.amount),
              })),
            }}
          />
        </div>
      </div>

      {!isTerminal && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Status</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            <button
              onClick={() => setStatus("paid")}
              disabled={loading}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
            >
              Mark paid
            </button>
            <button
              onClick={() => setStatus("void")}
              disabled={loading}
              className="rounded-md px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              Void
            </button>
          </div>
          {error && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
