"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SignaturePad, type SignaturePadHandle } from "./SignaturePad";

/**
 * Shared between the dispatcher's LoadDetailClient and the driver
 * portal's load view — one place that knows how to mark a load
 * delivered, so the two surfaces can never drift into different rules
 * about what's required or what gets written.
 *
 * This is proof-of-delivery capture, not a legally binding electronic
 * signature service — the copy here says so explicitly and no caller
 * should imply otherwise.
 */
export function DeliveryConfirmationForm({
  loadId,
  driverId,
}: {
  loadId: string;
  driverId: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const signatureRef = useRef<SignaturePadHandle>(null);

  const [signedByName, setSignedByName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMarkDelivered() {
    if (!driverId) {
      setError(
        "Assign a driver before marking this load delivered — that's who the pay-split goes to."
      );
      return;
    }
    if (!signedByName.trim()) {
      setError("Enter the name of the person signing for the delivery.");
      return;
    }
    const signatureDataUrl = signatureRef.current?.getDataUrl();
    if (!signatureDataUrl) {
      setError("Capture a signature before marking this load delivered.");
      return;
    }

    setError(null);
    setLoading(true);

    const { error: updateError } = await supabase
      .from("loads")
      .update({
        status: "delivered",
        delivered_at: new Date().toISOString(),
        signed_by_name: signedByName.trim(),
        signature_data: signatureDataUrl,
      })
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
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Record who signed for the delivery to mark this load delivered and
        queue the driver&apos;s pay.
      </p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
        This captures a proof-of-delivery signature, not a legally binding
        electronic signature.
      </p>

      <div className="mt-4 max-w-sm space-y-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Signed by
          </label>
          <input
            value={signedByName}
            onChange={(e) => setSignedByName(e.target.value)}
            placeholder="Recipient's name"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Signature
          </label>
          <div className="mt-1">
            <SignaturePad ref={signatureRef} />
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
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        onClick={handleMarkDelivered}
        disabled={loading}
        className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Mark delivered"}
      </button>
    </div>
  );
}
