"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  createSettlement,
  computeLoadPay,
  PAY_TYPE_LABEL,
  type SettlementLineItemInput,
} from "@/lib/create-settlement";

type Driver = {
  id: string;
  full_name: string;
  pay_type: string | null;
  pay_rate: number | null;
};
type DeliveredLoad = {
  id: string;
  load_number: string;
  client_name: string;
  client_rate: number;
  driver_pay: number;
  driver_id: string | null;
  miles: number | null;
};
type Advance = { id: string; driver_id: string; amount: number; reason: string | null };

/**
 * Picks a driver, computes what they're owed on each of their
 * delivered-and-unsettled loads using their configured pay method
 * (falling back to the load's own driver_pay if none is set), lets
 * outstanding advances be checked off as deductions, and adds optional
 * freeform deduction/reimbursement lines — then create_settlement()
 * (0019) writes it all as one call.
 *
 * Pay method (pay_type/pay_rate) is configured right here rather than
 * on the Drivers page — this is the one place it's actually used, and
 * saving it here just updates the drivers row directly, no separate
 * screen needed.
 *
 * Per-mile miles (0024): prefilled from the load's own Google Maps-
 * calculated dispatches.miles when present, still editable — exactly
 * the "fills in instead of being redesigned" outcome §83 flagged this
 * manual field as waiting for once real mileage tracking landed.
 */
export function CreateSettlementForm({
  companyId,
  drivers,
  deliveredLoads,
  advances,
}: {
  companyId: string;
  drivers: Driver[];
  deliveredLoads: DeliveredLoad[];
  advances: Advance[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [driverId, setDriverId] = useState("");
  const [payType, setPayType] = useState("");
  const [payRate, setPayRate] = useState("");
  const [payMethodSaved, setPayMethodSaved] = useState(true);
  const [savingPayMethod, setSavingPayMethod] = useState(false);

  const [selectedLoadIds, setSelectedLoadIds] = useState<Set<string>>(new Set());
  const [milesByLoad, setMilesByLoad] = useState<Map<string, string>>(new Map());
  const [selectedAdvanceIds, setSelectedAdvanceIds] = useState<Set<string>>(new Set());
  const [deductionDescription, setDeductionDescription] = useState("");
  const [deductionAmount, setDeductionAmount] = useState("");
  const [reimbursementDescription, setReimbursementDescription] = useState("");
  const [reimbursementAmount, setReimbursementAmount] = useState("");
  const [notes, setNotes] = useState("");

  const driverLoads = useMemo(
    () => deliveredLoads.filter((l) => l.driver_id === driverId),
    [deliveredLoads, driverId]
  );
  const driverAdvances = useMemo(
    () => advances.filter((a) => a.driver_id === driverId),
    [advances, driverId]
  );

  function selectDriver(id: string) {
    setDriverId(id);
    const driver = drivers.find((d) => d.id === id);
    setPayType(driver?.pay_type ?? "");
    setPayRate(driver?.pay_rate != null ? String(driver.pay_rate) : "");
    setPayMethodSaved(true);
    const thisDriversLoads = deliveredLoads.filter((l) => l.driver_id === id);
    setSelectedLoadIds(new Set(thisDriversLoads.map((l) => l.id)));
    // Prefill from Google Maps-calculated mileage where a load already
    // has it (0024) — still just a starting value, editable per row.
    const prefilledMiles = new Map<string, string>();
    for (const l of thisDriversLoads) {
      if (l.miles != null) prefilledMiles.set(l.id, String(l.miles));
    }
    setMilesByLoad(prefilledMiles);
    setSelectedAdvanceIds(new Set());
  }

  async function savePayMethod() {
    setSavingPayMethod(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("drivers")
      .update({
        pay_type: payType || null,
        pay_rate: payRate ? Number(payRate) : null,
      })
      .eq("id", driverId);
    setSavingPayMethod(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setPayMethodSaved(true);
  }

  function toggleLoad(id: string) {
    setSelectedLoadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAdvance(id: string) {
    setSelectedAdvanceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function loadPay(load: DeliveredLoad) {
    const miles = milesByLoad.get(load.id);
    return computeLoadPay(
      load,
      payType || null,
      payRate ? Number(payRate) : null,
      miles ? Number(miles) : null
    );
  }

  const loadPayTotal = driverLoads
    .filter((l) => selectedLoadIds.has(l.id))
    .reduce((sum, l) => sum + loadPay(l), 0);
  const advanceTotal = driverAdvances
    .filter((a) => selectedAdvanceIds.has(a.id))
    .reduce((sum, a) => sum + Number(a.amount), 0);
  const total =
    loadPayTotal +
    (Number(reimbursementAmount) || 0) -
    (Number(deductionAmount) || 0) -
    advanceTotal;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!driverId) {
      setError("Select a driver.");
      return;
    }
    if (!payMethodSaved) {
      setError("Save the pay method before creating the settlement.");
      return;
    }
    if (selectedLoadIds.size === 0 && !deductionDescription.trim() && !reimbursementDescription.trim()) {
      setError("Select at least one load, or add a line item.");
      return;
    }
    if (payType === "per_mile" && driverLoads.some((l) => selectedLoadIds.has(l.id) && !milesByLoad.get(l.id))) {
      setError("Enter miles for every selected load — this driver is paid per mile.");
      return;
    }

    const lineItems: SettlementLineItemInput[] = [];
    for (const load of driverLoads) {
      if (!selectedLoadIds.has(load.id)) continue;
      lineItems.push({
        loadId: load.id,
        lineType: "load_pay",
        description: `${load.load_number} — ${load.client_name}`,
        amount: loadPay(load),
      });
    }
    if (deductionDescription.trim() && Number(deductionAmount) > 0) {
      lineItems.push({
        lineType: "deduction",
        description: deductionDescription.trim(),
        amount: Number(deductionAmount),
      });
    }
    if (reimbursementDescription.trim() && Number(reimbursementAmount) > 0) {
      lineItems.push({
        lineType: "reimbursement",
        description: reimbursementDescription.trim(),
        amount: Number(reimbursementAmount),
      });
    }
    for (const advance of driverAdvances) {
      if (!selectedAdvanceIds.has(advance.id)) continue;
      lineItems.push({
        lineType: "advance_repayment",
        description: `Advance repayment${advance.reason ? ` — ${advance.reason}` : ""}`,
        amount: Number(advance.amount),
      });
    }

    setLoading(true);
    const { error: rpcError } = await createSettlement(supabase, {
      companyId,
      driverId,
      lineItems,
      advanceIds: Array.from(selectedAdvanceIds),
      notes: notes || null,
    });
    setLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setDriverId("");
    setSelectedLoadIds(new Set());
    setMilesByLoad(new Map());
    setSelectedAdvanceIds(new Set());
    setDeductionDescription("");
    setDeductionAmount("");
    setReimbursementDescription("");
    setReimbursementAmount("");
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
        + New settlement
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Driver</label>
        <select
          required
          value={driverId}
          onChange={(e) => selectDriver(e.target.value)}
          className="mt-1 block w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="">Select a driver…</option>
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.full_name}
            </option>
          ))}
        </select>
      </div>

      {driverId && (
        <>
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Pay method
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <select
                value={payType}
                onChange={(e) => {
                  setPayType(e.target.value);
                  setPayMethodSaved(false);
                }}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">No method set — use each load&apos;s driver pay</option>
                {Object.entries(PAY_TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {payType && (
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder={
                    payType === "percentage_of_rate" ? "0.70 = 70%" : payType === "per_mile" ? "$/mile" : "$/load"
                  }
                  value={payRate}
                  onChange={(e) => {
                    setPayRate(e.target.value);
                    setPayMethodSaved(false);
                  }}
                  className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              )}
              {!payMethodSaved && (
                <button
                  type="button"
                  onClick={savePayMethod}
                  disabled={savingPayMethod}
                  className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {savingPayMethod ? "Saving…" : "Save pay method"}
                </button>
              )}
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Delivered loads ready to settle
            </p>
            {driverLoads.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                No unsettled delivered loads for this driver.
              </p>
            ) : (
              <div className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {driverLoads.map((l) => (
                  <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedLoadIds.has(l.id)}
                        onChange={() => toggleLoad(l.id)}
                      />
                      {l.load_number} — {l.client_name}
                    </label>
                    <div className="flex items-center gap-3">
                      {payType === "per_mile" && (
                        <input
                          type="number"
                          min="0"
                          placeholder="miles"
                          value={milesByLoad.get(l.id) ?? ""}
                          onChange={(e) =>
                            setMilesByLoad((prev) => new Map(prev).set(l.id, e.target.value))
                          }
                          className="w-20 rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                        />
                      )}
                      <span className="text-slate-600 dark:text-slate-400">
                        ${loadPay(l).toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {driverAdvances.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Outstanding advances
              </p>
              <div className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {driverAdvances.map((a) => (
                  <label
                    key={a.id}
                    className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedAdvanceIds.has(a.id)}
                        onChange={() => toggleAdvance(a.id)}
                      />
                      {a.reason || "Advance"}
                    </span>
                    <span className="text-red-600 dark:text-red-400">
                      -${Number(a.amount).toFixed(2)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="grid grid-cols-[1fr,100px] gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Deduction (optional)
                </label>
                <input
                  value={deductionDescription}
                  onChange={(e) => setDeductionDescription(e.target.value)}
                  placeholder="Fuel card, insurance"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">$</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={deductionAmount}
                  onChange={(e) => setDeductionAmount(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-[1fr,100px] gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Reimbursement (optional)
                </label>
                <input
                  value={reimbursementDescription}
                  onChange={(e) => setReimbursementDescription(e.target.value)}
                  placeholder="Tolls, lumper fee"
                  className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">$</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={reimbursementAmount}
                  onChange={(e) => setReimbursementAmount(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>

          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
            Net:{" "}
            <span className="font-medium text-slate-900 dark:text-slate-100">${total.toFixed(2)}</span>
          </p>
        </>
      )}

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
          {loading ? "Creating…" : "Create settlement"}
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
