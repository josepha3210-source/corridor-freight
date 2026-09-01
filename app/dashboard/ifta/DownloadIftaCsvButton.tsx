"use client";

export type IftaCsvRow = {
  jurisdiction: string;
  jurisdiction_name: string;
  gallons: number;
  amount: number;
  purchase_count: number;
};

const COLUMNS: { key: keyof IftaCsvRow; header: string }[] = [
  { key: "jurisdiction", header: "Jurisdiction" },
  { key: "jurisdiction_name", header: "Name" },
  { key: "gallons", header: "Gallons" },
  { key: "amount", header: "Amount" },
  { key: "purchase_count", header: "Purchases" },
];

function escapeCsvField(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function DownloadIftaCsvButton({
  rows,
  year,
  quarter,
}: {
  rows: IftaCsvRow[];
  year: number;
  quarter: number;
}) {
  function handleDownload() {
    const header = COLUMNS.map((c) => escapeCsvField(c.header)).join(",");
    const lines = rows.map((row) => COLUMNS.map((c) => escapeCsvField(row[c.key])).join(","));
    const csv = [header, ...lines].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ifta-fuel-summary-${year}-Q${quarter}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleDownload}
      disabled={rows.length === 0}
      className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      Download as CSV
    </button>
  );
}
