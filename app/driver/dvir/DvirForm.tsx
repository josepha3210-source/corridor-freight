"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SignaturePad, type SignaturePadHandle } from "@/components/SignaturePad";
import { DVIR_CHECKLIST_ITEMS, blankChecklist } from "@/lib/dvir-checklist";

type Truck = { id: string; plate_number: string | null; make: string | null; model: string | null };

export function DvirForm({
  companyId,
  driverId,
  trucks,
}: {
  companyId: string;
  driverId: string;
  trucks: Truck[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const signatureRef = useRef<SignaturePadHandle>(null);

  const [submitted, setSubmitted] = useState(false);
  const [truckId, setTruckId] = useState("");
  const [inspectionType, setInspectionType] = useState<"pre_trip" | "post_trip">("pre_trip");
  const [checklist, setChecklist] = useState(blankChecklist());
  const [defectNotes, setDefectNotes] = useState("");
  const [signedByName, setSignedByName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defectsFound = checklist.some((c) => c.defect);

  function toggleDefect(item: string) {
    setChecklist((prev) => prev.map((c) => (c.item === item ? { ...c, defect: !c.defect } : c)));
  }

  async function handleSubmit() {
    setError(null);

    if (!truckId) {
      setError("Select which truck you're inspecting.");
      return;
    }
    if (!signedByName.trim()) {
      setError("Enter your name to sign this report.");
      return;
    }
    const signatureDataUrl = signatureRef.current?.getDataUrl();
    if (!signatureDataUrl) {
      setError("Capture your signature before submitting.");
      return;
    }

    setLoading(true);
    const { error: insertError } = await supabase.from("dvir_reports").insert({
      company_id: companyId,
      truck_id: truckId,
      driver_id: driverId,
      inspection_type: inspectionType,
      checklist,
      defects_found: defectsFound,
      defect_notes: defectsFound ? defectNotes || null : null,
      satisfactory: !defectsFound,
      signed_by_name: signedByName.trim(),
      signature_data: signatureDataUrl,
    });
    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSubmitted(true);
    router.refresh();
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
          Inspection report submitted.
        </p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {defectsFound
            ? "Defects were noted — let your dispatcher know before this truck goes out again."
            : "No defects found."}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-4 sm:grid-cols-2">
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
                {t.plate_number || `${t.make ?? ""} ${t.model ?? ""}`.trim() || t.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Inspection type
          </label>
          <select
            value={inspectionType}
            onChange={(e) => setInspectionType(e.target.value as "pre_trip" | "post_trip")}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="pre_trip">Pre-trip</option>
            <option value="post_trip">Post-trip</option>
          </select>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          Check every item — tap anything with a defect
        </p>
        <div className="mt-2 divide-y divide-slate-100 rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {DVIR_CHECKLIST_ITEMS.map((item) => {
            const hasDefect = checklist.find((c) => c.item === item)?.defect ?? false;
            return (
              <label
                key={item}
                className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="text-slate-700 dark:text-slate-300">{item}</span>
                <span className="flex items-center gap-2">
                  <span className={hasDefect ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
                    {hasDefect ? "Defect" : "OK"}
                  </span>
                  <input
                    type="checkbox"
                    checked={hasDefect}
                    onChange={() => toggleDefect(item)}
                  />
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {defectsFound && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Describe the defect(s)
          </label>
          <textarea
            value={defectNotes}
            onChange={(e) => setDefectNotes(e.target.value)}
            rows={2}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
      )}

      <div className="mt-4 max-w-sm space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Signed by
          </label>
          <input
            value={signedByName}
            onChange={(e) => setSignedByName(e.target.value)}
            placeholder="Your name"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Signature
          </label>
          <div className="mt-1">
            <SignaturePad ref={signatureRef} onDraw={() => setError(null)} />
          </div>
          <button
            type="button"
            onClick={() => signatureRef.current?.clear()}
            className="mt-1 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Clear signature
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Submitting…" : "Submit inspection"}
      </button>
    </div>
  );
}
