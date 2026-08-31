"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/StatusBadge";
import { DeliveryConfirmationForm } from "@/components/DeliveryConfirmationForm";

type Driver = { id: string; full_name: string; status: "active" | "inactive" };

type Load = {
  id: string;
  load_number: string;
  client_name: string;
  pickup_location: string;
  pickup_at: string | null;
  dropoff_location: string;
  dropoff_at: string | null;
  status: string;
  client_rate: number;
  driver_pay: number;
  driver_id: string | null;
  signed_by_name: string | null;
  signature_data: string | null;
  delivered_at: string | null;
  notes: string | null;
};

export function LoadDetailClient({
  load,
  driverName,
  drivers,
  companyLogoUrl,
}: {
  load: Load;
  driverName: string | null;
  drivers: Driver[];
  companyLogoUrl?: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  // The dropdown only offers active drivers for a *new* assignment, but
  // keeps whoever's currently assigned visible (even if inactive) so
  // opening Edit doesn't look like the load silently lost its driver.
  const selectableDrivers = drivers.filter(
    (d) => d.status === "active" || d.id === load.driver_id
  );

  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  // Split by section rather than one shared `error` — a validation
  // message about delivery has no business appearing under the Status
  // card above it, and vice versa.
  const [editError, setEditError] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Edit-form state, seeded from the load whenever edit mode opens.
  const [loadNumber, setLoadNumber] = useState(load.load_number);
  const [clientName, setClientName] = useState(load.client_name);
  const [driverId, setDriverId] = useState(load.driver_id ?? "");
  const [pickupLocation, setPickupLocation] = useState(load.pickup_location);
  const [pickupAt, setPickupAt] = useState(toLocalInput(load.pickup_at));
  const [dropoffLocation, setDropoffLocation] = useState(load.dropoff_location);
  const [dropoffAt, setDropoffAt] = useState(toLocalInput(load.dropoff_at));
  const [clientRate, setClientRate] = useState(String(load.client_rate));
  const [driverPay, setDriverPay] = useState(String(load.driver_pay));
  const [notes, setNotes] = useState(load.notes ?? "");

  const liveMargin = (Number(clientRate) || 0) - (Number(driverPay) || 0);
  const savedMargin = Number(load.client_rate) - Number(load.driver_pay);

  const isDelivered = load.status === "delivered";
  const isCancelled = load.status === "cancelled";
  const isTerminal = isDelivered || isCancelled;

  function startEdit() {
    setLoadNumber(load.load_number);
    setClientName(load.client_name);
    setDriverId(load.driver_id ?? "");
    setPickupLocation(load.pickup_location);
    setPickupAt(toLocalInput(load.pickup_at));
    setDropoffLocation(load.dropoff_location);
    setDropoffAt(toLocalInput(load.dropoff_at));
    setClientRate(String(load.client_rate));
    setDriverPay(String(load.driver_pay));
    setNotes(load.notes ?? "");
    setEditError(null);
    setIsEditing(true);
  }

  async function updateLoad(
    patch: Record<string, unknown>,
    setErr: (msg: string | null) => void = setStatusError
  ) {
    setErr(null);
    setLoading(true);
    const { error: updateError } = await supabase
      .from("loads")
      .update(patch)
      .eq("id", load.id);
    setLoading(false);
    if (updateError) {
      setErr(updateError.message);
      return false;
    }
    router.refresh();
    return true;
  }

  async function saveEdit() {
    // Reassigning to/from "unassigned" only moves the status forward
    // automatically, never backward — going from in_transit to
    // unassigned because a driver got cleared would be a bigger, more
    // deliberate change than an edit form should make on its own.
    const nextStatus =
      driverId && load.status === "unassigned" ? "assigned" : load.status;

    const ok = await updateLoad(
      {
        load_number: loadNumber,
        client_name: clientName,
        driver_id: driverId || null,
        status: nextStatus,
        pickup_location: pickupLocation,
        pickup_at: pickupAt || null,
        dropoff_location: dropoffLocation,
        dropoff_at: dropoffAt || null,
        client_rate: Number(clientRate) || 0,
        driver_pay: Number(driverPay) || 0,
        notes: notes || null,
      },
      setEditError
    );
    if (ok) setIsEditing(false);
  }

  if (isEditing) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Edit load</h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <EditField label="Load #" value={loadNumber} onChange={setLoadNumber} />
          <EditField label="Client name" value={clientName} onChange={setClientName} />

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
              {selectableDrivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.full_name}
                  {d.status === "inactive" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div />

          <EditField
            label="Pickup location"
            value={pickupLocation}
            onChange={setPickupLocation}
          />
          <EditField
            label="Pickup time"
            type="datetime-local"
            value={pickupAt}
            onChange={setPickupAt}
          />

          <EditField
            label="Dropoff location"
            value={dropoffLocation}
            onChange={setDropoffLocation}
          />
          <EditField
            label="Dropoff time"
            type="datetime-local"
            value={dropoffAt}
            onChange={setDropoffAt}
          />

          <EditField
            label="Client rate ($)"
            type="number"
            value={clientRate}
            onChange={setClientRate}
          />
          <EditField
            label="Driver pay ($)"
            type="number"
            value={driverPay}
            onChange={setDriverPay}
          />
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          Margin:{" "}
          <span className="font-medium text-slate-900 dark:text-slate-100">
            ${liveMargin.toFixed(2)}
          </span>
        </p>

        {editError && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {editError}
          </p>
        )}

        <div className="mt-4 flex gap-3">
          <button
            onClick={saveEdit}
            disabled={loading}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => setIsEditing(false)}
            disabled={loading}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
              {load.load_number}
            </p>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {load.client_name}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={load.status} />
            {!isTerminal && (
              <button
                onClick={startEdit}
                className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Detail label="Driver" value={driverName ?? "Unassigned"} />
          <Detail label="Pickup" value={load.pickup_location} sub={formatDate(load.pickup_at)} />
          <Detail label="Dropoff" value={load.dropoff_location} sub={formatDate(load.dropoff_at)} />
          <Detail label="Client rate" value={`$${Number(load.client_rate).toFixed(2)}`} />
          <Detail label="Driver pay" value={`$${Number(load.driver_pay).toFixed(2)}`} />
          <Detail label="Company margin" value={`$${savedMargin.toFixed(2)}`} />
        </dl>

        {load.notes && (
          <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            {load.notes}
          </p>
        )}
      </div>

      {!isTerminal && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Status</h3>
          <div className="mt-3 flex flex-wrap gap-3">
            {load.status !== "in_transit" && (
              <button
                onClick={() => updateLoad({ status: "in_transit" })}
                disabled={loading}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-60"
              >
                Mark in transit
              </button>
            )}
            <button
              onClick={() => updateLoad({ status: "cancelled" })}
              disabled={loading}
              className="rounded-md px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              Cancel load
            </button>
          </div>
          {statusError && (
            <p className="mt-3 text-xs text-red-600 dark:text-red-400">{statusError}</p>
          )}
        </div>
      )}

      {!isTerminal && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Delivery confirmation
          </h3>
          <DeliveryConfirmationForm loadId={load.id} driverId={load.driver_id} />
        </div>
      )}

      {isDelivered && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            {companyLogoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={companyLogoUrl}
                alt="Company logo"
                className="h-8 w-8 rounded object-contain"
              />
            )}
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Delivery confirmation
            </h3>
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Signed by <strong>{load.signed_by_name}</strong> on{" "}
            {formatDate(load.delivered_at)}. Create this driver&apos;s
            payment from the{" "}
            <a href="/dashboard/payroll" className="text-brand-700 hover:underline dark:text-brand-400">
              Payroll
            </a>{" "}
            page.
          </p>
          {load.signature_data && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={load.signature_data}
              alt={`Signature of ${load.signed_by_name ?? "recipient"}`}
              className="mt-4 max-w-xs rounded-md border border-slate-200 bg-white dark:border-slate-700"
            />
          )}
        </div>
      )}
    </div>
  );
}

function Detail({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string | null;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">{value}</dd>
      {sub && <dd className="text-xs text-slate-500 dark:text-slate-400">{sub}</dd>}
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        step={type === "number" ? "0.01" : undefined}
        min={type === "number" ? "0" : undefined}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/** <input type="datetime-local"> wants "YYYY-MM-DDTHH:mm" in local time, not an ISO/UTC string. */
function toLocalInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
