"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Truck = { id: string; plate_number: string | null };

const WEIGHT_CATEGORIES = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
  "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V",
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function AddHvutFilingForm({ companyId, trucks }: { companyId: string; trucks: Truck[] }) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [truckId, setTruckId] = useState("");
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear()));
  const [weightCategory, setWeightCategory] = useState("");
  const [firstUsedMonth, setFirstUsedMonth] = useState("7"); // July — the standard HVUT tax period start
  const [taxAmount, setTaxAmount] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!truckId || !weightCategory) {
      setError("Select a truck and its weight category.");
      return;
    }

    setLoading(true);
    const { error: insertError } = await supabase.from("hvut_filings").insert({
      company_id: companyId,
      truck_id: truckId,
      tax_year: Number(taxYear),
      weight_category: weightCategory,
      first_used_month: Number(firstUsedMonth),
      tax_amount: taxAmount ? Number(taxAmount) : null,
      notes: notes || null,
    });
    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTruckId("");
    setWeightCategory("");
    setTaxAmount("");
    setNotes("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        + Track a filing
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Truck</label>
          <select
            required
            value={truckId}
            onChange={(e) => setTruckId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Select…</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plate_number || t.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tax year</label>
          <input
            type="number"
            required
            value={taxYear}
            onChange={(e) => setTaxYear(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Weight category
          </label>
          <select
            required
            value={weightCategory}
            onChange={(e) => setWeightCategory(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Select…</option>
            {WEIGHT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c} ({55000 + (c.charCodeAt(0) - 65) * 1000}
                {c === "V" ? "+" : ""} lbs)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            First used month
          </label>
          <select
            value={firstUsedMonth}
            onChange={(e) => setFirstUsedMonth(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Tax amount ($, optional)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={taxAmount}
            onChange={(e) => setTaxAmount(e.target.value)}
            placeholder="From your 2290 instructions"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Notes (optional)
        </label>
        <input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Preparer, confirmation #, etc."
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-4 flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
