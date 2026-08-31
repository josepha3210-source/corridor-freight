"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Owner-only, same as Billing — enforced by the caller not rendering
 * this at all for anyone else, and re-checked again server-side by the
 * delete-company route itself. Independent of Billing's "cancel plan"
 * (Task B) — cancelling a subscription stops future charges and keeps
 * the company and its data; this deletes the company and every
 * member's login entirely, whether or not it has a paid plan at all.
 */
export function DangerZone({ companyName }: { companyName: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [confirmText, setConfirmText] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDeleting(true);

    const res = await fetch("/dashboard/settings/danger/delete-company", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmName: confirmText }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setDeleting(false);
      setError(body.error ?? "Something went wrong deleting the company.");
      return;
    }

    // The route just deleted this account's own auth.users row along
    // with everyone else's — sign out proactively rather than waiting
    // for a future request to discover the session no longer resolves
    // to anything.
    setDeleted(true);
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (deleted) {
    return (
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Your company has been permanently deleted. Signing you out…
      </p>
    );
  }

  return (
    <section className="mt-6 rounded-xl border-2 border-red-300 bg-red-50/50 p-6 dark:border-red-500/40 dark:bg-red-500/5">
      <h2 className="text-lg font-semibold text-red-800 dark:text-red-400">
        Danger zone
      </h2>
      <p className="mt-1 text-sm text-red-700 dark:text-red-400/90">
        Permanently delete <strong>{companyName}</strong> — every load,
        driver, payment, and teammate login, gone for good. This cannot
        be undone. This is different from cancelling a paid plan: your
        company and its data stay if you just cancel billing.
      </p>

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-md border border-red-600 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-500 dark:text-red-400 dark:hover:bg-red-500/10"
        >
          Delete company
        </button>
      ) : (
        <form onSubmit={handleDelete} className="mt-4 max-w-sm space-y-3">
          <div>
            <label className="block text-sm font-medium text-red-800 dark:text-red-400">
              Type <strong>{companyName}</strong> to confirm
            </label>
            <input
              type="text"
              required
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-1 block w-full rounded-md border border-red-300 px-3 py-2 text-sm shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 dark:border-red-500/40 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          {error && (
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={deleting || confirmText !== companyName}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Permanently delete company"}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                setConfirmText("");
                setError(null);
              }}
              disabled={deleting}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Never mind
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
