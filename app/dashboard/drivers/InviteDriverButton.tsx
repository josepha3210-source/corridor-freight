"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteDriverButton({ driverId }: { driverId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function invite() {
    setError(null);
    setLoading(true);

    const res = await fetch("/dashboard/drivers/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ driverId }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong sending the invite.");
      return;
    }

    setSent(true);
    router.refresh();
  }

  if (sent) {
    return (
      <span className="text-xs text-slate-500 dark:text-slate-400">
        Invite sent
      </span>
    );
  }

  return (
    <div>
      <button
        onClick={invite}
        disabled={loading}
        className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-60 dark:text-brand-400"
      >
        {loading ? "Sending…" : "Invite to portal"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
