"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { createContact } from "@/lib/create-contact";
import { createLoad, calculateMileage } from "@/lib/create-load";

type Driver = { id: string; full_name: string };
type Customer = { id: string; name: string };
type Truck = { id: string; plate_number: string | null };

/**
 * load_number is deliberately not a field here — the set_load_number
 * trigger (0002 migration) assigns the next one for this company on
 * insert. It only becomes editable later, from the load's detail page.
 *
 * client_rate and driver_pay are captured as two plain numbers; margin
 * (what the company keeps) is charge minus pay, computed for display
 * everywhere it's shown and never written to a column, so it can't drift
 * out of sync with the two numbers it's built from.
 *
 * Customer picker (Phase 3b): picks an existing contacts row
 * (type='customer') or, if "New customer" is selected, creates one
 * inline via the same createContact() Customers/Address Book use — no
 * separate trip to the Customers page needed just to book a load for
 * someone new. `client_name` is still written too (denormalized from
 * whichever customer name was resolved) — every existing read site
 * (the loads list, load detail, CSV export, driver portal, dashboard)
 * still works unchanged; `customer_id` is the new source of truth
 * going forward, this isn't a breaking column swap.
 *
 * Since Phase 3c (0017) a "load" is really three rows — the booking
 * (loads), who's executing it (dispatches), and its stops (load_stops)
 * — created together via the create_load_with_dispatch() RPC
 * (lib/create-load.ts) instead of a single insert, so a load can't be
 * left half-created if something fails partway through.
 *
 * Mileage (0024): "Calculate" hits the Google Maps Distance Matrix
 * route when configured (mileageEnabled, from isGoogleMapsConfigured()
 * on the server page) — always just a prefill into a plain editable
 * number field, never the only way to set it, since the feature is
 * genuinely optional and a dispatcher who knows the real mileage
 * shouldn't be blocked on an API call to enter it.
 */
export function CreateLoadForm({
  companyId,
  drivers,
  customers,
  trucks,
  mileageEnabled,
}: {
  companyId: string;
  drivers: Driver[];
  customers: Customer[];
  trucks: Truck[];
  mileageEnabled: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const NEW_CUSTOMER = "__new__";
  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [pickupAt, setPickupAt] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [dropoffAt, setDropoffAt] = useState("");
  const [driverId, setDriverId] = useState("");
  const [truckId, setTruckId] = useState("");
  const [clientRate, setClientRate] = useState("");
  const [driverPay, setDriverPay] = useState("");
  const [miles, setMiles] = useState("");
  const [calculatingMiles, setCalculatingMiles] = useState(false);
  const [mileageNote, setMileageNote] = useState<string | null>(null);

  const margin = (Number(clientRate) || 0) - (Number(driverPay) || 0);

  async function handleCalculateMileage() {
    if (!pickupLocation.trim() || !dropoffLocation.trim()) {
      setMileageNote("Enter both pickup and dropoff locations first.");
      return;
    }
    setCalculatingMiles(true);
    setMileageNote(null);
    const result = await calculateMileage(pickupLocation, dropoffLocation);
    setCalculatingMiles(false);
    if (!result) {
      setMileageNote("Couldn't calculate mileage for that route — enter it manually.");
      return;
    }
    setMiles(result.miles.toFixed(1));
    setMileageNote(`${result.distanceText} via Google Maps.`);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!customerId) {
      setError("Select a customer, or choose \"New customer\" and enter a name.");
      return;
    }
    if (customerId === NEW_CUSTOMER && !newCustomerName.trim()) {
      setError("Enter a name for the new customer.");
      return;
    }

    setLoading(true);

    let resolvedCustomerId = customerId;
    let resolvedClientName =
      customers.find((c) => c.id === customerId)?.name ?? "";

    if (customerId === NEW_CUSTOMER) {
      const { data: newCustomer, error: contactError } = await createContact(
        supabase,
        { companyId, type: "customer", name: newCustomerName.trim() }
      );
      if (contactError || !newCustomer) {
        setLoading(false);
        setError(contactError?.message ?? "Could not create the customer.");
        return;
      }
      resolvedCustomerId = newCustomer.id;
      resolvedClientName = newCustomer.name;
    }

    const { error: rpcError } = await createLoad(supabase, {
      companyId,
      customerId: resolvedCustomerId,
      clientName: resolvedClientName,
      clientRate: Number(clientRate) || 0,
      driverId: driverId || null,
      driverPay: Number(driverPay) || 0,
      pickupLocation,
      pickupAt: pickupAt || null,
      dropoffLocation,
      dropoffAt: dropoffAt || null,
      miles: miles ? Number(miles) : null,
      truckId: truckId || null,
    });

    setLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setCustomerId("");
    setNewCustomerName("");
    setPickupLocation("");
    setPickupAt("");
    setDropoffLocation("");
    setDropoffAt("");
    setDriverId("");
    setTruckId("");
    setClientRate("");
    setDriverPay("");
    setMiles("");
    setMileageNote(null);
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
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Customer
          </label>
          <select
            required
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Select a customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value={NEW_CUSTOMER}>+ New customer…</option>
          </select>
          {customerId === NEW_CUSTOMER && (
            <input
              autoFocus
              required
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="New customer name"
              className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
          )}
        </div>
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
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Truck (optional)
          </label>
          <select
            value={truckId}
            onChange={(e) => setTruckId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">Not recorded</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plate_number || t.id.slice(0, 8)}
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
          required
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
          required
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

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Miles (optional)
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              step="0.1"
              min="0"
              value={miles}
              onChange={(e) => setMiles(e.target.value)}
              placeholder="e.g. 412.5"
              className="block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            />
            {mileageEnabled && (
              <button
                type="button"
                onClick={handleCalculateMileage}
                disabled={calculatingMiles}
                className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {calculatingMiles ? "Calculating…" : "Calculate"}
              </button>
            )}
          </div>
          {mileageNote && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{mileageNote}</p>
          )}
        </div>
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
