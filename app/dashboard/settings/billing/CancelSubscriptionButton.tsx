"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * One button, label and behavior driven by subscriptionStatus — see
 * app/dashboard/settings/billing/cancel/route.ts for what each path
 * actually does server-side.
 */
export function CancelSubscriptionButton({
  subscriptionStatus,
}: {
  subscriptionStatus: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const isTrialing = subscriptionStatus === "trialing";
  const label = isTrialing ? "Cancel trial" : "Cancel plan";

  async function handleCancel() {
    setError(null);
    setMessage(null);
    setLoading(true);

    const res = await fetch("/dashboard/settings/billing/cancel", {
      method: "POST",
    });
    const body = await res.json().catch(() => ({}));

    setLoading(false);
    setConfirming(false);

    if (!res.ok) {
      setError(body.error ?? "Something went wrong cancelling.");
      return;
    }

    if (body.canceledImmediately) {
      setMessage("Your trial has been cancelled.");
    } else {
      setMessage(
        body.accessUntil
          ? `Your plan is set to cancel — you'll keep access until ${new Date(
              body.accessUntil
            ).toLocaleDateString()}.`
          : "Your plan is set to cancel at the end of the current billing period."
      );
    }

    router.refresh();
  }

  if (!confirming) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
        >
          {label}
        </button>
        {message && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {message}
          </p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-500/30 dark:bg-red-500/10">
      <p className="text-sm text-red-800 dark:text-red-400">
        {isTrialing
          ? "Cancel your trial? No charge will ever happen."
          : "Cancel your plan? You'll keep access until the period you already paid for ends."}
      </p>
      <div className="mt-2 flex gap-3">
        <button
          type="button"
          onClick={handleCancel}
          disabled={loading}
          className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
        >
          {loading ? "Cancelling…" : `Yes, ${label.toLowerCase()}`}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          Never mind
        </button>
      </div>
    </div>
  );
}
