"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Name and phone only — status (active/inactive) is the archive
 * mechanism (see DriverRow.tsx's Deactivate/Reactivate), and a driver
 * being able to flip that on themselves would be exactly the
 * self-archive path the spec says dispatcher/owner should keep. This
 * form simply never sends that field; migration 0006's "drivers can
 * update own driver record" RLS policy is row-scoped like every other
 * update policy in this schema, so the real guard is this form's own
 * discipline about what it submits, not a database-level column block.
 */
export function DriverProfileForm({
  driverId,
  fullName: initialFullName,
  phone: initialPhone,
  email,
  status,
}: {
  driverId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  status: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState(initialFullName);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);

    const { error: updateError } = await supabase
      .from("drivers")
      .update({ full_name: fullName, phone: phone || null })
      .eq("id", driverId);

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Full name
        </label>
        <input
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Phone
        </label>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 555-0100"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Email
        </label>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {email ?? "—"}
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Status
        </label>
        <p className="mt-1 text-sm capitalize text-slate-600 dark:text-slate-400">
          {status} — managed by your dispatcher
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="text-sm text-green-700 dark:text-green-400">Saved.</p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
