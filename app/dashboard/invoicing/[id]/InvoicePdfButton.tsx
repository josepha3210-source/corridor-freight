"use client";

import { useState } from "react";
import type { InvoicePdfData } from "./InvoicePdfDocument";

/**
 * Generates the PDF client-side (no server round trip, no stored file)
 * via @react-pdf/renderer's imperative pdf().toBlob() — same
 * anchor-click download pattern as DownloadCsvButton/
 * DownloadPayrollCsvButton, just a PDF blob instead of a CSV one.
 *
 * @react-pdf/renderer itself is loaded with a dynamic import inside the
 * click handler, not a top-level import — it's a genuinely heavy
 * library, and every other visitor to this page who never clicks
 * "Download PDF" shouldn't pay for it in their initial bundle.
 */
export function InvoicePdfButton({ data }: { data: InvoicePdfData }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const [{ pdf }, { InvoicePdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./InvoicePdfDocument"),
      ]);
      const blob = await pdf(<InvoicePdfDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${data.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {loading ? "Generating…" : "Download PDF"}
    </button>
  );
}
