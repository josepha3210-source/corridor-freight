"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Owner+admin — same boundary as the rest of the Company section this
 * sits in, not Billing's stricter owner-only gate. Every upload
 * overwrites the same object path (<company_id>/logo, no extension —
 * Storage keeps the real content-type from what's uploaded regardless),
 * so there's never a stale old file left behind to clean up separately.
 */
export function CompanyLogoUpload({
  companyId,
  logoUrl,
}: {
  companyId: string;
  logoUrl: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    const { error: uploadError } = await supabase.storage
      .from("company-logos")
      .upload(`${companyId}/logo`, file, {
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      setUploading(false);
      setError(uploadError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from("companies")
      .update({ logo_updated_at: new Date().toISOString() })
      .eq("id", companyId);

    setUploading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
    router.refresh();
  }

  return (
    <div className="mt-4 flex items-center gap-4">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt="Company logo"
          className="h-16 w-16 rounded-md border border-slate-200 object-contain dark:border-slate-700"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-md border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-700 dark:text-slate-500">
          No logo
        </div>
      )}

      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          onChange={handleFileChange}
          disabled={uploading}
          className="block text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-600 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-brand-700 dark:text-slate-400"
        />
        {uploading && (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
            Uploading…
          </p>
        )}
        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
