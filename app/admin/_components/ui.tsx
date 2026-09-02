import Link from "next/link";
import { STATUS_LABEL, STATUS_CLASSES } from "@/lib/billing-format";

/**
 * Small presentational pieces shared across the /admin pages. Folder is
 * `_components` (underscore-prefixed) so Next never treats it as a route
 * segment.
 *
 * These deliberately reuse the tenant dashboard's existing visual
 * language rather than inventing an admin style: the stat tile is the
 * same card as `app/dashboard/page.tsx`'s `StatTile`, and the
 * subscription badge is driven by the same `STATUS_LABEL` /
 * `STATUS_CLASSES` maps (`lib/billing-format.ts`) that the tenant
 * Settings → Billing page already renders.
 */

export function StatTile({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">{hint}</p>
      )}
    </>
  );
  const className =
    "rounded-xl border border-slate-200 bg-white p-6 transition dark:border-slate-800 dark:bg-slate-900";

  return href ? (
    <Link href={href} className={`${className} hover:border-brand-500 hover:shadow-sm`}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

export function SubscriptionBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_CLASSES[status] ??
        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
      }`}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
