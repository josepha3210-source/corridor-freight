"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createInvoice, PAYMENT_TERMS_DAYS } from "@/lib/create-invoice";

type Customer = { id: string; name: string; payment_terms: string | null };
type DeliveredLoad = {
  id: string;
  load_number: string;
  client_name: string;
  client_rate: number;
  customer_id: string | null;
};

/**
 * Picks a customer, then every one of THEIR delivered-and-not-yet-
 * invoiced loads becomes a checkbox line item defaulting to checked —
 * "generate from delivered dispatch" per the v2 spec, batched across
 * however many loads are ready to bill at once rather than one invoice
 * per load. Due date defaults from the customer's payment_terms
 * (contacts.payment_terms, 0016) but stays editable — a customer with
 * no terms set just gets a blank date to fill in by hand.
 */
export function CreateInvoiceForm({
  companyId,
  customers,
  deliveredLoads,
}: {
  companyId: string;
  customers: Customer[];
  deliveredLoads: DeliveredLoad[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [selectedLoadIds, setSelectedLoadIds] = useState<Set<string>>(new Set());
  const [dueAt, setDueAt] = useState("");
  const [extraDescription, setExtraDescription] = useState("");
  const [extraAmount, setExtraAmount] = useState("");

  const customerLoads = useMemo(
    () => deliveredLoads.filter((l) => l.customer_id === customerId),
    [deliveredLoads, customerId]
  );

  const total =
    customerLoads
      .filter((l) => selectedLoadIds.has(l.id))
      .reduce((sum, l) => sum + Number(l.client_rate), 0) +
    (Number(extraAmount) || 0);

  function selectCustomer(id: string) {
    setCustomerId(id);
    // Default to every eligible load checked — the common case is
    // "bill everything that's ready," not picking one at a time.
    setSelectedLoadIds(new Set(deliveredLoads.filter((l) => l.customer_id === id).map((l) => l.id)));
    const customer = customers.find((c) => c.id === id);
    const days = customer?.payment_terms ? PAYMENT_TERMS_DAYS[customer.payment_terms] : null;
    setDueAt(days ? addDays(new Date(), days) : "");
  }

  function toggleLoad(id: string) {
    setSelectedLoadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customerId) {
      setError("Select a customer.");
      return;
    }
    if (selectedLoadIds.size === 0 && !extraDescription.trim()) {
      setError("Select at least one delivered load, or add a line item.");
      return;
    }

    setLoading(true);
    const { error: rpcError } = await createInvoice(supabase, {
      companyId,
      customerId,
      loadIds: Array.from(selectedLoadIds),
      dueAt: dueAt || null,
      extraDescription: extraDescription || null,
      extraAmount: Number(extraAmount) || null,
    });
    setLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setCustomerId("");
    setSelectedLoadIds(new Set());
    setDueAt("");
    setExtraDescription("");
    setExtraAmount("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        + New invoice
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Customer
          </label>
          <select
            required
            value={customerId}
            onChange={(e) => selectCustomer(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Select a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Due date
          </label>
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      {customerId && (
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Delivered loads ready to bill
          </p>
          {customerLoads.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              No delivered, unbilled loads for this customer.
            </p>
          ) : (
            <div className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {customerLoads.map((l) => (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedLoadIds.has(l.id)}
                      onChange={() => toggleLoad(l.id)}
                    />
                    {l.load_number} — {l.client_name}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400">
                    ${Number(l.client_rate).toFixed(2)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Extra line item (optional)
          </label>
          <input
            value={extraDescription}
            onChange={(e) => setExtraDescription(e.target.value)}
            placeholder="Detention, lumper fee, etc."
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Amount ($)
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={extraAmount}
            onChange={(e) => setExtraAmount(e.target.value)}
            placeholder="0.00"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
        Total:{" "}
        <span className="font-medium text-slate-900 dark:text-slate-100">
          ${total.toFixed(2)}
        </span>
      </p>

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
          {loading ? "Creating…" : "Create invoice"}
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

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
