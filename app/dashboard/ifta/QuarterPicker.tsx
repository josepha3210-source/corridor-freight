"use client";

import { useRouter } from "next/navigation";

/** Plain year/quarter selects that navigate via the URL's own query string — no client state to keep in sync with the server-rendered table below it. */
export function QuarterPicker({ year, quarter }: { year: number; quarter: number }) {
  const router = useRouter();

  const years = Array.from({ length: 5 }, (_, i) => year - 2 + i);

  function navigate(nextYear: number, nextQuarter: number) {
    router.push(`/dashboard/ifta?year=${nextYear}&quarter=${nextQuarter}`);
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={year}
        onChange={(e) => navigate(Number(e.target.value), quarter)}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
      <select
        value={quarter}
        onChange={(e) => navigate(year, Number(e.target.value))}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        {[1, 2, 3, 4].map((q) => (
          <option key={q} value={q}>
            Q{q}
          </option>
        ))}
      </select>
    </div>
  );
}
