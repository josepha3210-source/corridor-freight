"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Driver = { id: string; full_name: string };

/**
 * Cash given to a driver ahead of a settlement — an outstanding advance
 * becomes a selectable deduction the next time CreateSettlementForm
 * builds a settlement for that driver (0019).
 */
export function RecordAdvanceForm({
  companyId,
  drivers,
}: {
  companyId: string;
  drivers: Driver[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [driverId, setDriverId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!driverId || !(Number(amount) > 0)) {
      setError("Select a driver and enter an amount greater than $0.");
      return;
    }

    setLoading(true);
    const { error: insertError } = await supabase.from("driver_advances").insert({
      company_id: companyId,
      driver_id: driverId,
      amount: Number(amount),
      reason: reason || null,
    });
    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setDriverId("");
    setAmount("");
    setReason("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        + Record advance
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Driver</label>
        <select
          required
          value={driverId}
          onChange={(e) => setDriverId(e.target.value)}
          className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="">Select…</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.full_name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Amount ($)</label>
        <input
          type="number"
          step="0.01"
          min="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-1 w-28 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">Reason</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Fuel, repair, etc."
          className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={loading}
        className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
      >
        Cancel
      </button>
      {error && <p className="w-full text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
