"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function MarkPaidButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  async function markPaid() {
    setLoading(true);
    await supabase
      .from("payments")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("id", paymentId);
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={markPaid}
      disabled={loading}
      className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
    >
      {loading ? "Marking…" : "Mark paid"}
    </button>
  );
}
