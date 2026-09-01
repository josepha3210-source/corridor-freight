"use client";

import { useState } from "react";
import type { SettlementPdfData } from "./SettlementPdfDocument";

/** Same dynamic-import-on-click pattern as InvoicePdfButton — @react-pdf/renderer stays out of this page's initial bundle. */
export function SettlementPdfButton({ data }: { data: SettlementPdfData }) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const [{ pdf }, { SettlementPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("./SettlementPdfDocument"),
      ]);
      const blob = await pdf(<SettlementPdfDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `settlement-${data.driverName.replace(/\s+/g, "-").toLowerCase()}-${data.createdAt}.pdf`;
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
