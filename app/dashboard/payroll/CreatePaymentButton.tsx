"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * One of these per delivered-load-without-a-payment-yet row. Amount
 * defaults to the load's driver_pay (the number set back when the load
 * was created/edited) but stays editable — the pay-split isn't locked in
 * until someone actually queues the payment.
 */
export function CreatePaymentButton({
  companyId,
  loadId,
  driverId,
  driverPay,
}: {
  companyId: string;
  loadId: string;
  driverId: string;
  driverPay: number;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(driverPay));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: insertError } = await supabase.from("payments").insert({
      company_id: companyId,
      load_id: loadId,
      driver_id: driverId,
      amount: Number(amount) || 0,
      status: "pending",
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
      >
        Create payment
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <span className="text-xs text-slate-500 dark:text-slate-400">$</span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        autoFocus
      />
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Creating…" : "Confirm"}
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        disabled={loading}
        className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
      >
        Cancel
      </button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </form>
  );
}
