"use client";

export type LoadCsvRow = {
  load_number: string;
  client_name: string;
  driver_name: string;
  pickup_location: string;
  dropoff_location: string;
  status: string;
  client_rate: number;
  driver_pay: number;
  margin: number;
};

const COLUMNS: { key: keyof LoadCsvRow; header: string }[] = [
  { key: "load_number", header: "Load #" },
  { key: "client_name", header: "Client" },
  { key: "driver_name", header: "Driver" },
  { key: "pickup_location", header: "Pickup" },
  { key: "dropoff_location", header: "Dropoff" },
  { key: "status", header: "Status" },
  { key: "client_rate", header: "Client Rate" },
  { key: "driver_pay", header: "Driver Pay" },
  { key: "margin", header: "Margin" },
];

function escapeCsvField(value: string | number): string {
  const s = String(value);
  // Quote anything that would otherwise break the CSV grid, doubling any
  // quotes already in the field per the standard CSV escaping rule.
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Takes exactly the rows the page already rendered (post status-filter),
 * so "download as CSV" always matches what's on screen rather than
 * silently re-fetching the unfiltered table.
 */
export function DownloadCsvButton({ rows }: { rows: LoadCsvRow[] }) {
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
    link.download = `loads-${new Date().toISOString().slice(0, 10)}.csv`;
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
