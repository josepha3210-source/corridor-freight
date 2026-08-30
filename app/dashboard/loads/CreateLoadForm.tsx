"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Driver = { id: string; full_name: string };

/**
 * load_number is deliberately not a field here — the set_load_number
 * trigger (0002 migration) assigns the next one for this company on
 * insert. It only becomes editable later, from the load's detail page.
 *
 * client_rate and driver_pay are captured as two plain numbers; margin
 * (what the company keeps) is charge minus pay, computed for display
 * everywhere it's shown and never written to a column, so it can't drift
 * out of sync with the two numbers it's built from.
 */
export function CreateLoadForm({
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

  const [clientName, setClientName] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [pickupAt, setPickupAt] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [dropoffAt, setDropoffAt] = useState("");
  const [driverId, setDriverId] = useState("");
  const [clientRate, setClientRate] = useState("");
  const [driverPay, setDriverPay] = useState("");

  const margin = (Number(clientRate) || 0) - (Number(driverPay) || 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: insertError } = await supabase.from("loads").insert({
      company_id: companyId,
      client_name: clientName,
      pickup_location: pickupLocation,
      pickup_at: pickupAt || null,
      dropoff_location: dropoffLocation,
      dropoff_at: dropoffAt || null,
      driver_id: driverId || null,
      status: driverId ? "assigned" : "unassigned",
      client_rate: Number(clientRate) || 0,
      driver_pay: Number(driverPay) || 0,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setClientName("");
    setPickupLocation("");
    setPickupAt("");
    setDropoffLocation("");
    setDropoffAt("");
    setDriverId("");
    setClientRate("");
    setDriverPay("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        + New load
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Client name"
          value={clientName}
          onChange={setClientName}
          placeholder="Acme Foods"
          required
        />
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Driver
          </label>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Unassigned</option>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name}
              </option>
            ))}
          </select>
        </div>

        <Field
          label="Pickup location"
          value={pickupLocation}
          onChange={setPickupLocation}
          placeholder="Joliet, IL"
          required
        />
        <Field
          label="Pickup time"
          type="datetime-local"
          value={pickupAt}
          onChange={setPickupAt}
        />

        <Field
          label="Dropoff location"
          value={dropoffLocation}
          onChange={setDropoffLocation}
          placeholder="Aurora, CO"
          required
        />
        <Field
          label="Dropoff time"
          type="datetime-local"
          value={dropoffAt}
          onChange={setDropoffAt}
        />

        <Field
          label="Client rate ($)"
          type="number"
          value={clientRate}
          onChange={setClientRate}
          placeholder="1200.00"
        />
        <Field
          label="Driver pay ($)"
          type="number"
          value={driverPay}
          onChange={setDriverPay}
          placeholder="850.00"
        />
      </div>

      <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
        Margin:{" "}
        <span className="font-medium text-slate-900 dark:text-slate-100">
          ${margin.toFixed(2)}
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
          {loading ? "Creating…" : "Create load"}
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
    </div>
  );
}
