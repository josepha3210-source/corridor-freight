"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Driver = { id: string; full_name: string };

export function AddTruckForm({
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

  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [vin, setVin] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [plateState, setPlateState] = useState("");
  const [assignedDriverId, setAssignedDriverId] = useState("");
  const [registrationExpiresAt, setRegistrationExpiresAt] = useState("");
  const [insuranceExpiresAt, setInsuranceExpiresAt] = useState("");
  const [nextInspectionDueAt, setNextInspectionDueAt] = useState("");
  const [odometer, setOdometer] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: insertError } = await supabase.from("trucks").insert({
      company_id: companyId,
      make: make || null,
      model: model || null,
      year: year ? Number(year) : null,
      vin: vin || null,
      plate_number: plateNumber || null,
      plate_state: plateState || null,
      assigned_driver_id: assignedDriverId || null,
      registration_expires_at: registrationExpiresAt || null,
      insurance_expires_at: insuranceExpiresAt || null,
      next_inspection_due_at: nextInspectionDueAt || null,
      odometer: odometer ? Number(odometer) : null,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setMake("");
    setModel("");
    setYear("");
    setVin("");
    setPlateNumber("");
    setPlateState("");
    setAssignedDriverId("");
    setRegistrationExpiresAt("");
    setInsuranceExpiresAt("");
    setNextInspectionDueAt("");
    setOdometer("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        + Add truck
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Make" value={make} onChange={setMake} placeholder="Freightliner" />
        <Field label="Model" value={model} onChange={setModel} placeholder="Cascadia" />
        <Field label="Year" type="number" value={year} onChange={setYear} placeholder="2022" />
        <Field label="VIN" value={vin} onChange={setVin} placeholder="1FUJGHDV..." />
        <Field label="Plate number" value={plateNumber} onChange={setPlateNumber} placeholder="ABC1234" />
        <Field label="Plate state" value={plateState} onChange={setPlateState} placeholder="CO" />

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Assigned driver
          </label>
          <select
            value={assignedDriverId}
            onChange={(e) => setAssignedDriverId(e.target.value)}
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
        <Field label="Odometer" type="number" value={odometer} onChange={setOdometer} placeholder="145000" />
        <div />

        <Field
          label="Registration expires"
          type="date"
          value={registrationExpiresAt}
          onChange={setRegistrationExpiresAt}
        />
        <Field
          label="Insurance expires"
          type="date"
          value={insuranceExpiresAt}
          onChange={setInsuranceExpiresAt}
        />
        <Field
          label="Next inspection due"
          type="date"
          value={nextInspectionDueAt}
          onChange={setNextInspectionDueAt}
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
          {loading ? "Adding…" : "Add truck"}
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
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
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
        placeholder={placeholder}
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      />
    </div>
  );
}
