"use client";

type Row = { description: string; amount: number };

/**
 * A QuickBooks-compatible CSV, not a live QuickBooks Online API sync —
 * no OAuth app/developer credentials exist for that, same "don't fake
 * an integration that isn't really there" reasoning as every
 * Stripe-not-configured message in this app. This column layout
 * (Invoice No / Customer / Invoice Date / Due Date / Description /
 * Amount, one row per line item) is what QBO's own CSV-based invoice
 * import tools expect — genuinely importable, just not a push-button
 * live sync.
 */
export function InvoiceCsvButton({
  invoiceNumber,
  customerName,
  issuedAt,
  dueAt,
  lineItems,
}: {
  invoiceNumber: string;
  customerName: string;
  issuedAt: string;
  dueAt: string | null;
  lineItems: Row[];
}) {
  function escapeCsvField(value: string | number): string {
    const s = String(value);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }

  function handleDownload() {
    const header = ["Invoice No", "Customer", "Invoice Date", "Due Date", "Description", "Amount"]
      .map(escapeCsvField)
      .join(",");
    const lines = lineItems.map((li) =>
      [invoiceNumber, customerName, issuedAt, dueAt ?? "", li.description, li.amount.toFixed(2)]
        .map(escapeCsvField)
        .join(",")
    );
    const csv = [header, ...lines].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${invoiceNumber}-quickbooks.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleDownload}
      disabled={lineItems.length === 0}
      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      QuickBooks CSV
    </button>
  );
}
