"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { InviteDriverButton } from "./InviteDriverButton";
import { isValidDriverName } from "@/lib/create-driver";

export type Driver = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  status: "active" | "inactive";
  user_id: string | null;
};

/**
 * One row, doing double duty as both the read view and the edit form —
 * simpler than a separate edit page for a table this narrow, and it
 * means Cancel just means "throw away local state," no navigation.
 */
export function DriverRow({ driver }: { driver: Driver }) {
  const router = useRouter();
  const supabase = createClient();

  const [isEditing, setIsEditing] = useState(false);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState(driver.full_name);
  const [phone, setPhone] = useState(driver.phone ?? "");
  const [email, setEmail] = useState(driver.email ?? "");
  const [status, setStatus] = useState(driver.status);

  function startEdit() {
    setFullName(driver.full_name);
    setPhone(driver.phone ?? "");
    setEmail(driver.email ?? "");
    setStatus(driver.status);
    setError(null);
    setIsEditing(true);
  }

  async function save() {
    setError(null);

    if (!isValidDriverName(fullName)) {
      setError("Enter a first and last name (at least 2 characters each).");
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase
      .from("drivers")
      .update({
        full_name: fullName,
        phone: phone || null,
        email: email || null,
        status,
      })
      .eq("id", driver.id);
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setIsEditing(false);
    router.refresh();
  }

  // Drivers are never hard-deleted — RLS no longer even permits it (see
  // 0003 migration). "Deactivate" just flips status, same as toggling it
  // in the edit form; past loads/payments keep pointing at this row and
  // display it correctly, they just can't pick it for new assignments.
  async function setDriverStatus(nextStatus: "active" | "inactive") {
    setError(null);
    setLoading(true);
    const { error: updateError } = await supabase
      .from("drivers")
      .update({ status: nextStatus })
      .eq("id", driver.id);
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    setConfirmingDeactivate(false);
    router.refresh();
  }

  if (isEditing) {
    return (
      <tr className="bg-brand-50/40 dark:bg-brand-500/10">
        <td className="px-6 py-3">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </td>
        <td className="px-6 py-3">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </td>
        <td className="px-6 py-3">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </td>
        <td className="px-6 py-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            className="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </td>
        <td className="px-6 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={save}
              disabled={loading}
              className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {loading ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setIsEditing(false)}
              disabled={loading}
              className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
          {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
        </td>
        <td className="px-6 py-3" />
      </tr>
    );
  }

  return (
    <tr>
      <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
        {driver.full_name}
      </td>
      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{driver.phone || "—"}</td>
      <td className="px-6 py-3 text-slate-600 dark:text-slate-400">{driver.email || "—"}</td>
      <td className="px-6 py-3">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            driver.status === "active"
              ? "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {driver.status}
        </span>
      </td>
      <td className="px-6 py-3">
        {confirmingDeactivate ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-400">Deactivate?</span>
            <button
              onClick={() => setDriverStatus("inactive")}
              disabled={loading}
              className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60 dark:text-red-400"
            >
              {loading ? "Working…" : "Yes"}
            </button>
            <button
              onClick={() => setConfirmingDeactivate(false)}
              disabled={loading}
              className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
            >
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-4 divide-x divide-slate-200 dark:divide-slate-700">
            <button
              onClick={startEdit}
              className="rounded px-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50 hover:underline dark:text-brand-400 dark:hover:bg-brand-500/10"
            >
              Edit
            </button>
            {driver.status === "active" ? (
              <button
                onClick={() => setConfirmingDeactivate(true)}
                className="rounded px-1 pl-4 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:underline dark:text-red-400 dark:hover:bg-red-500/10"
              >
                Deactivate
              </button>
            ) : (
              <button
                onClick={() => setDriverStatus("active")}
                disabled={loading}
                className="rounded px-1 pl-4 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50 hover:underline disabled:opacity-60 dark:text-brand-400 dark:hover:bg-brand-500/10"
              >
                {loading ? "Working…" : "Reactivate"}
              </button>
            )}
          </div>
        )}
        {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
      </td>
      <td className="px-6 py-3">
        {driver.user_id ? (
          <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/10 dark:text-green-400">
            Claimed
          </span>
        ) : driver.email ? (
          <InviteDriverButton driverId={driver.id} />
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            Add an email first
          </span>
        )}
      </td>
    </tr>
  );
}
