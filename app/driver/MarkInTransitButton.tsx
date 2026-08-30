"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * The database is the real guard here (migration 0006's "drivers can
 * advance their own assigned loads" policy only allows landing on
 * in_transit/delivered, and only for a load that's actually theirs) —
 * this button just calls the same update any dispatcher's LoadDetailClient
 * would, RLS does the rest.
 */
export function MarkInTransitButton({ loadId }: { loadId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markInTransit() {
    setLoading(true);
    setError(null);
    const { error: updateError } = await supabase
      .from("loads")
      .update({ status: "in_transit" })
      .eq("id", loadId);
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <button
        onClick={markInTransit}
        disabled={loading}
        className="rounded-md bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-60"
      >
        {loading ? "Updating…" : "Mark in transit"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
