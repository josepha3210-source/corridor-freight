"use client";

export type PayrollCsvRow = {
  driver_name: string;
  load_number: string;
  client_name: string;
  amount: number;
  status: string;
  paid_at: string;
};

const COLUMNS: { key: keyof PayrollCsvRow; header: string }[] = [
  { key: "driver_name", header: "Driver" },
  { key: "load_number", header: "Load #" },
  { key: "client_name", header: "Client" },
  { key: "amount", header: "Amount" },
  { key: "status", header: "Status" },
  { key: "paid_at", header: "Paid At" },
];

function escapeCsvField(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * The exportable pay statement — every payment on file (pending and
 * paid), one row each, so this is a complete driver-payroll export a
 * carrier can hand to a bookkeeper without asking us for it first.
 */
export function DownloadPayrollCsvButton({ rows }: { rows: PayrollCsvRow[] }) {
  function handleDownload() {
    const header = COLUMNS.map((c) => escapeCsvField(c.header)).join(",");
    const lines = rows.map((row) =>
      COLUMNS.map((c) => escapeCsvField(row[c.key])).join(",")
    );
    const csv = [header, ...lines].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `payroll-${new Date().toISOString().slice(0, 10)}.csv`;
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
