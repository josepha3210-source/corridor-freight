"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Driver = { id: string; full_name: string };
type Truck = { id: string; plate_number: string | null };

const CATEGORY_LABEL: Record<string, string> = {
  driver_license: "Driver license",
  driver_medical_card: "Driver medical card",
  truck_registration: "Truck registration",
  truck_insurance: "Truck insurance",
  company_insurance: "Company insurance",
  other: "Other",
};

/**
 * Uploads to the private company-documents bucket (0022) — object path
 * is `{companyId}/{random}-{filename}`, then a `documents` row records
 * the metadata (category, related driver/truck, expiration) pointing
 * at it. Two writes, not one RPC — unlike create_load_with_dispatch,
 * there's no correctness risk in a metadata row existing without its
 * file succeeding first (the insert only runs after the upload
 * succeeds), and no risk in the reverse either since an orphaned
 * Storage object with no metadata row is just invisible, not broken.
 */
export function UploadDocumentForm({
  companyId,
  drivers,
  trucks,
}: {
  companyId: string;
  drivers: Driver[];
  trucks: Truck[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState("other");
  const [title, setTitle] = useState("");
  const [driverId, setDriverId] = useState("");
  const [truckId, setTruckId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    if (!title.trim()) {
      setError("Enter a title for this document.");
      return;
    }

    setLoading(true);

    const path = `${companyId}/${crypto.randomUUID()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("company-documents")
      .upload(path, file, { contentType: file.type });

    if (uploadError) {
      setLoading(false);
      setError(uploadError.message);
      return;
    }

    const { error: insertError } = await supabase.from("documents").insert({
      company_id: companyId,
      driver_id: driverId || null,
      truck_id: truckId || null,
      category,
      title: title.trim(),
      file_path: path,
      expires_at: expiresAt || null,
    });

    setLoading(false);

    if (insertError) {
      // The file uploaded but its metadata row didn't — leaves an
      // orphaned Storage object rather than a broken document row.
      // Surfacing the real error rather than silently retrying, since
      // a retry here would just upload the same file again under a new
      // random path.
      setError(insertError.message);
      return;
    }

    setCategory("other");
    setTitle("");
    setDriverId("");
    setTruckId("");
    setExpiresAt("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        + Upload document
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
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="2026 CDL — J. Rowan"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Expires (optional)
          </label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Driver (optional)
          </label>
          <select
            value={driverId}
            onChange={(e) => setDriverId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="">None</option>
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
            <option value="">None</option>
            {trucks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.plate_number || t.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">File</label>
          <input
            ref={fileInputRef}
            type="file"
            className="mt-1 block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700 dark:text-slate-400"
          />
        </div>
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
          {loading ? "Uploading…" : "Upload"}
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
