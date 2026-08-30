const STYLES: Record<string, string> = {
  unassigned: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  assigned: "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  in_transit: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
  delivered: "bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STYLES[status] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
      }`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
