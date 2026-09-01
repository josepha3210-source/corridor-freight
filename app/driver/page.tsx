import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { requireDriver } from "@/lib/current-driver";
import { formatCurrency } from "@/lib/format";
import { MarkInTransitButton } from "./MarkInTransitButton";

/**
 * A real dashboard, not just a raw list (Phase 1) — today's dispatch
 * gets its own hero card instead of being buried at the top of a list
 * that looks the same as every other row, plus this week's completed
 * deliveries and (since Phase 4b, 0019) the driver's own latest
 * settlement. The DVIR prompt still degrades gracefully — DVIR (Phase
 * 5b) doesn't exist yet, same "build the layout now, data fills in
 * later" philosophy as the owner dashboard's "Needs attention soon"
 * panel.
 *
 * No driver_id filter anywhere here — migration 0006's "drivers can
 * view their own assigned loads" RLS policy already scopes every query
 * to exactly this driver's own loads. That's deliberate: this page
 * can't accidentally show someone else's load even if this code had a
 * bug, because the database itself won't return the row.
 */
export default async function DriverDashboardPage() {
  const { supabase, driver } = await requireDriver();
  if (!driver) return null;

  const sevenDaysAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // loads_with_dispatch (0017) — dispatch_id threaded through for
  // MarkInTransitButton, which now writes to `dispatches`.
  const [{ data: activeLoads }, { data: deliveredThisWeek }, { data: latestSettlement }] =
    await Promise.all([
      supabase
        .from("loads_with_dispatch")
        .select(
          "id, dispatch_id, load_number, client_name, pickup_location, pickup_at, dropoff_location, dropoff_at, status"
        )
        .in("status", ["assigned", "in_transit"])
        .order("pickup_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("loads_with_dispatch")
        .select("id, load_number, client_name, delivered_at, driver_pay")
        .eq("status", "delivered")
        .gte("delivered_at", sevenDaysAgoIso)
        .order("delivered_at", { ascending: false }),
      // Settlements (Phase 4b, 0019) — RLS scopes this to the driver's
      // own rows the same way loads_with_dispatch already is. Most
      // recent non-void settlement stands in for "current pay period"
      // since there's no fixed pay-period calendar built yet.
      supabase
        .from("settlements")
        .select("id, status, created_at, settlement_line_items ( line_type, amount )")
        .neq("status", "void")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const loads = activeLoads ?? [];
  // "Today's dispatch" — in_transit takes priority over merely assigned
  // (it's already moving), then whichever has the soonest pickup/dropoff.
  // Everything else still shows in the list below it, just not repeated
  // at the top too.
  const todaysDispatch =
    loads.find((l) => l.status === "in_transit") ?? loads[0] ?? null;
  const restOfLoads = loads.filter((l) => l.id !== todaysDispatch?.id);

  const deliveries = deliveredThisWeek ?? [];
  const weekEarnings = deliveries.reduce((sum, l) => sum + Number(l.driver_pay), 0);

  const settlementLineItems =
    (latestSettlement?.settlement_line_items as unknown as
      | { line_type: string; amount: number }[]
      | null) ?? [];
  const latestSettlementNet = settlementLineItems.reduce((sum, li) => {
    const signed =
      li.line_type === "deduction" || li.line_type === "advance_repayment"
        ? -Number(li.amount)
        : Number(li.amount);
    return sum + signed;
  }, 0);

  return (
    <>
      <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
        My Loads
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Today&apos;s and upcoming assigned loads.
      </p>

      {/* DVIR prompt — real now (Phase 5b, 0021), was just a
          placeholder comment before. Required before/after each duty
          day, so it sits above the dispatch hero, not below it. */}
      <Link
        href="/driver/dvir"
        className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand-500 dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Vehicle inspection (DVIR)
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Pre-trip or post-trip — required before each duty day.
          </p>
        </div>
        <span className="text-sm font-medium text-brand-700 dark:text-brand-400">Start →</span>
      </Link>

      {/* Hero — today's dispatch, front and center. */}
      {todaysDispatch ? (
        <div className="mt-4 rounded-xl border-2 border-brand-500 bg-white p-5 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
            Current dispatch
          </p>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {todaysDispatch.load_number}
              </p>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {todaysDispatch.client_name}
              </p>
            </div>
            <StatusBadge status={todaysDispatch.status} />
          </div>

          <dl className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">Pickup</dt>
              <dd className="text-right text-slate-900 dark:text-slate-100">
                {todaysDispatch.pickup_location}
                <br />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(todaysDispatch.pickup_at)}
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500 dark:text-slate-400">Dropoff</dt>
              <dd className="text-right text-slate-900 dark:text-slate-100">
                {todaysDispatch.dropoff_location}
                <br />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {formatDateTime(todaysDispatch.dropoff_at)}
                </span>
              </dd>
            </div>
          </dl>

          <div className="mt-4 flex items-center gap-3">
            {todaysDispatch.status === "assigned" && (
              <MarkInTransitButton dispatchId={todaysDispatch.dispatch_id} />
            )}
            <Link
              href={`/driver/loads/${todaysDispatch.id}`}
              className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
            >
              {todaysDispatch.status === "in_transit"
                ? "Confirm delivery →"
                : "View details →"}
            </Link>
          </div>
        </div>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
          No loads assigned to you right now.
        </p>
      )}

      {/* This week's completed deliveries + running earnings — real pay
          totals need Phase 4b's settlement methods; this is delivered-
          load driver_pay summed, an approximation until then. */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            This week
          </h2>
          {deliveries.length > 0 && (
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {formatCurrency(weekEarnings)}
            </span>
          )}
        </div>
        {deliveries.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            No deliveries completed in the last 7 days.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {deliveries.map((load) => (
              <li key={load.id} className="flex items-center justify-between gap-3">
                <span className="text-slate-700 dark:text-slate-300">
                  {load.client_name}
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  {formatCurrency(Number(load.driver_pay))}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
          {deliveries.length > 0
            ? "Estimated from delivered loads — your actual settlement (below) may include deductions or reimbursements."
            : "An estimate from delivered loads, not an official settlement."}
        </p>
      </div>

      {/* Most recent settlement — real number now that Settlements
          (Phase 4b, 0019) exists, not a placeholder promise. */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Latest settlement
          </h2>
          {latestSettlement && (
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {formatCurrency(latestSettlementNet)}
            </span>
          )}
        </div>
        {latestSettlement ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {latestSettlement.status === "paid" ? "Paid" : "Pending"} — created{" "}
            {new Date(latestSettlement.created_at).toLocaleDateString()}.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            No settlements yet — this fills in once your dispatcher creates
            your first one.
          </p>
        )}
      </div>

      {/* Rest of the assigned loads, if any beyond today's dispatch. */}
      {restOfLoads.length > 0 && (
        <div className="mt-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Also assigned to you
          </h2>
          {restOfLoads.map((load) => (
            <div
              key={load.id}
              className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    {load.load_number}
                  </p>
                  <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {load.client_name}
                  </p>
                </div>
                <StatusBadge status={load.status} />
              </div>

              <dl className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Pickup</dt>
                  <dd className="text-right text-slate-900 dark:text-slate-100">
                    {load.pickup_location}
                    <br />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(load.pickup_at)}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Dropoff</dt>
                  <dd className="text-right text-slate-900 dark:text-slate-100">
                    {load.dropoff_location}
                    <br />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatDateTime(load.dropoff_at)}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center gap-3">
                {load.status === "assigned" && (
                  <MarkInTransitButton dispatchId={load.dispatch_id} />
                )}
                <Link
                  href={`/driver/loads/${load.id}`}
                  className="text-sm font-medium text-brand-700 hover:underline dark:text-brand-400"
                >
                  {load.status === "in_transit"
                    ? "Confirm delivery →"
                    : "View details →"}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "No time set";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
