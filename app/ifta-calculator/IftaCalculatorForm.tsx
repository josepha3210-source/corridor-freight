"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IFTA_JURISDICTIONS } from "@/lib/ifta-jurisdictions";
import { IFTA_EXAMPLE_RATES } from "@/lib/ifta-example-rates";

type Row = { id: number; jurisdiction: string; miles: string; gallons: string; rate: string };

let nextRowId = 1;
function blankRow(): Row {
  return { id: nextRowId++, jurisdiction: "", miles: "", gallons: "", rate: "" };
}

/**
 * A real IFTA math calculator — same underlying formula IFTA itself
 * uses (net taxable gallons = miles driven in a jurisdiction ÷ fleet-
 * wide average MPG, minus gallons already purchased there; tax owed or
 * credited = net taxable gallons × that jurisdiction's rate) — but the
 * per-jurisdiction rate is an editable "example" value
 * (lib/ifta-example-rates.ts), never presented as current. Gated
 * behind an email capture (ifta_calculator_leads, 0030) — this is what
 * makes it a real marketing lead source, not just a free tool.
 */
export function IftaCalculatorForm() {
  const supabase = createClient();

  const now = new Date();
  const [baseJurisdiction, setBaseJurisdiction] = useState("");
  const [year, setYear] = useState(String(now.getFullYear()));
  const [quarter, setQuarter] = useState(String(Math.floor(now.getMonth() / 3) + 1));
  const [fuelType, setFuelType] = useState("diesel");
  const [rows, setRows] = useState<Row[]>([blankRow(), blankRow()]);

  const [email, setEmail] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateRow(id: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function setJurisdiction(id: number, jurisdiction: string) {
    const exampleRate = IFTA_EXAMPLE_RATES[jurisdiction];
    updateRow(id, {
      jurisdiction,
      rate: exampleRate != null ? String(exampleRate) : "",
    });
  }

  function addRow() {
    setRows((prev) => [...prev, blankRow()]);
  }

  function removeRow(id: number) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== id) : prev));
  }

  const totalMiles = rows.reduce((sum, r) => sum + (Number(r.miles) || 0), 0);
  const totalGallons = rows.reduce((sum, r) => sum + (Number(r.gallons) || 0), 0);
  const avgMpg = totalGallons > 0 ? totalMiles / totalGallons : 0;

  const rowResults = rows.map((r) => {
    const miles = Number(r.miles) || 0;
    const gallonsPurchased = Number(r.gallons) || 0;
    const rate = Number(r.rate) || 0;
    const taxableGallons = avgMpg > 0 ? miles / avgMpg : 0;
    const netTaxableGallons = taxableGallons - gallonsPurchased;
    const taxOwed = netTaxableGallons * rate;
    return { ...r, taxableGallons, netTaxableGallons, taxOwed };
  });

  const estimatedTotal = rowResults.reduce((sum, r) => sum + r.taxOwed, 0);
  const hasEnoughData = totalMiles > 0 && totalGallons > 0 && rows.some((r) => r.jurisdiction && r.rate);

  async function handleUnlock() {
    setError(null);
    if (!email.trim() || !email.includes("@")) {
      setError("Enter a valid email to see your estimate.");
      return;
    }
    setSubmitting(true);
    // Best-effort — a failed insert still unlocks the estimate for this
    // visitor; the point of gating is capturing the lead when it works,
    // not blocking someone from seeing their own math over a network hiccup.
    await supabase.from("ifta_calculator_leads").insert({
      email: email.trim(),
      base_jurisdiction: baseJurisdiction || null,
      quarter_label: `${year} Q${quarter}`,
      fuel_type: fuelType,
      total_miles: totalMiles,
      total_gallons: totalGallons,
      estimated_total: estimatedTotal,
    });
    setSubmitting(false);
    setUnlocked(true);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Base jurisdiction
          </label>
          <select
            value={baseJurisdiction}
            onChange={(e) => setBaseJurisdiction(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Select…</option>
            {IFTA_JURISDICTIONS.map((j) => (
              <option key={j.code} value={j.code}>
                {j.name} ({j.code})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Quarter</label>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-24 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              {[1, 2, 3, 4].map((q) => (
                <option key={q} value={q}>
                  Q{q}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Fuel type</label>
          <select
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="diesel">Diesel</option>
            <option value="gasoline">Gasoline</option>
          </select>
        </div>
      </div>

      <div className="mt-6">
        <div className="grid grid-cols-[1fr,90px,90px,90px,28px] gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span>Jurisdiction</span>
          <span>Miles</span>
          <span>Gallons</span>
          <span>Rate ($/gal)</span>
          <span />
        </div>
        <div className="mt-2 space-y-2">
          {rows.map((r) => (
            <div key={r.id} className="grid grid-cols-[1fr,90px,90px,90px,28px] gap-2">
              <select
                value={r.jurisdiction}
                onChange={(e) => setJurisdiction(r.id, e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">Select…</option>
                {IFTA_JURISDICTIONS.map((j) => (
                  <option key={j.code} value={j.code}>
                    {j.code}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min="0"
                value={r.miles}
                onChange={(e) => updateRow(r.id, { miles: e.target.value })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="number"
                min="0"
                value={r.gallons}
                onChange={(e) => updateRow(r.id, { gallons: e.target.value })}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <input
                type="number"
                step="0.001"
                min="0"
                value={r.rate}
                onChange={(e) => updateRow(r.id, { rate: e.target.value })}
                placeholder="example"
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => removeRow(r.id)}
                className="text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                aria-label="Remove row"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          + Add jurisdiction
        </button>
      </div>

      <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400">
        Rates shown are examples for illustration only, not current
        IFTA rates — edit any rate to your own jurisdiction's actual
        current rate before relying on this. This is an estimate, not a
        filing.
      </p>

      {!unlocked ? (
        <div className="mt-6 rounded-lg border border-dashed border-slate-300 p-6 text-center dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Enter your email to see your estimated total.
          </p>
          <div className="mx-auto mt-3 flex max-w-sm gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={handleUnlock}
              disabled={submitting || !hasEnoughData}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? "…" : "See estimate"}
            </button>
          </div>
          {!hasEnoughData && (
            <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
              Fill in at least one jurisdiction with miles, gallons, and a rate first.
            </p>
          )}
          {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-slate-200 p-6 dark:border-slate-800">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Estimated total ({year} Q{quarter}, {totalMiles.toLocaleString()} mi, avg{" "}
            {avgMpg.toFixed(2)} mpg)
          </p>
          <p className="mt-1 text-3xl font-semibold text-slate-900 dark:text-slate-100">
            ${estimatedTotal.toFixed(2)}
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-1 pr-3">Jurisdiction</th>
                  <th className="py-1 pr-3">Net taxable gal.</th>
                  <th className="py-1">Owed / (credit)</th>
                </tr>
              </thead>
              <tbody>
                {rowResults
                  .filter((r) => r.jurisdiction)
                  .map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 pr-3">{r.jurisdiction}</td>
                      <td className="py-1.5 pr-3">{r.netTaxableGallons.toFixed(2)}</td>
                      <td className="py-1.5">${r.taxOwed.toFixed(2)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
