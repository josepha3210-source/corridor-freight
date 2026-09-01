"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function HvutStatusActions({
  filingId,
  status,
  scheduleOneReceived,
}: {
  filingId: string;
  status: string;
  scheduleOneReceived: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function update(patch: Record<string, unknown>) {
    setLoading(true);
    await supabase.from("hvut_filings").update(patch).eq("id", filingId);
    setLoading(false);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status !== "filed" && status !== "paid" && (
        <button
          onClick={() => update({ filing_status: "filed", filed_at: new Date().toISOString().slice(0, 10) })}
          disabled={loading}
          className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-60 dark:text-brand-400"
        >
          Mark filed
        </button>
      )}
      {status === "filed" && (
        <button
          onClick={() => update({ filing_status: "paid" })}
          disabled={loading}
          className="text-xs font-medium text-green-700 hover:underline disabled:opacity-60 dark:text-green-400"
        >
          Mark paid
        </button>
      )}
      {!scheduleOneReceived && status !== "not_filed" && (
        <button
          onClick={() => update({ schedule_1_received: true })}
          disabled={loading}
          className="text-xs font-medium text-slate-600 hover:underline disabled:opacity-60 dark:text-slate-400"
        >
          Got Schedule 1
        </button>
      )}
    </div>
  );
}
