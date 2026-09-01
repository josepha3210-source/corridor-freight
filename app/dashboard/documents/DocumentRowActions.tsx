"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * The bucket is private (0022), so there's no public URL to link to —
 * "Download" fetches a short-lived signed URL on demand instead of
 * baking one into the server-rendered page (those expire, and
 * shouldn't sit around in HTML).
 */
export function DocumentRowActions({ documentId, filePath }: { documentId: string; filePath: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleDownload() {
    setLoading(true);
    setError(null);
    const { data, error: signError } = await supabase.storage
      .from("company-documents")
      .createSignedUrl(filePath, 60);
    setLoading(false);

    if (signError || !data) {
      setError(signError?.message ?? "Could not generate a download link.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleDelete() {
    setLoading(true);
    setError(null);
    await supabase.storage.from("company-documents").remove([filePath]);
    const { error: deleteError } = await supabase.from("documents").delete().eq("id", documentId);
    setLoading(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleDownload}
        disabled={loading}
        className="text-xs font-medium text-brand-700 hover:underline disabled:opacity-60 dark:text-brand-400"
      >
        Download
      </button>
      {confirmingDelete ? (
        <>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="text-xs font-medium text-red-600 hover:underline disabled:opacity-60 dark:text-red-400"
          >
            Confirm delete
          </button>
          <button
            onClick={() => setConfirmingDelete(false)}
            disabled={loading}
            className="text-xs font-medium text-slate-500 hover:underline dark:text-slate-400"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          onClick={() => setConfirmingDelete(true)}
          className="text-xs font-medium text-slate-500 hover:text-red-600 hover:underline dark:text-slate-400 dark:hover:text-red-400"
        >
          Delete
        </button>
      )}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
