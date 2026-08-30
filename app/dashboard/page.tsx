import Link from "next/link";
import { requireProfile } from "@/lib/current-profile";
import { formatCurrency } from "@/lib/format";
import { getViewerTimeZone, getTodayRangeInTimeZone } from "@/lib/timezone";

/**
 * The dispatcher's one screen to live on — see ROADMAP.md §61's "minimal
 * ops view" decision. Five sections, in the order a dispatcher actually
 * needs them: what's overdue right now, what still has no driver, what's
 * scheduled today, what's owed to drivers, and (owner/admin only) how the
 * business is doing. Every row links out to the screen that can act on it
 * — this page itself never mutates anything.
 *
 * "Today" is the viewer's actual calendar day (lib/timezone.ts, synced via
 * components/TimezoneSync.tsx), not the server's — a dispatcher in Denver
 * and one wherever the server runs need different answers once it's
 * already tomorrow for one of them. "Overdue" doesn't need that same
 * treatment: a past instant in time is the same instant everywhere, so
 * `now` is compared directly with no timezone conversion involved.
 */
const LIST_LIMIT = 10;

type LoadPreview = {
  id: string;
  load_number: string;
  client_name: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_at: string | null;
  dropoff_at: string | null;
  drivers: { full_name: string } | null;
};

const LOAD_PREVIEW_COLUMNS =
  "id, load_number, client_name, pickup_location, dropoff_location, pickup_at, dropoff_at, drivers ( full_name )";

export default async function DashboardPage() {
  const { supabase, profile, companyName } = await requireProfile();
  const canSeeRevenue = profile?.role === "owner" || profile?.role === "admin";

  // Cheapest possible check first: a brand-new company has never created a
  // load, and none of the five sections below are worth rendering (each
  // would just be an empty state) — show one onboarding banner instead.
  const { count: everHadLoads } = await supabase
    .from("loads")
    .select("id", { count: "exact", head: true });

  if (!everHadLoads) {
    return (
      <>
        <DashboardHeader companyName={companyName} profile={profile} />
        <OnboardingBanner />
      </>
    );
  }

  const nowIso = new Date().toISOString();
  const { start: startOfToday, end: startOfTomorrow } = getTodayRangeInTimeZone(
    getViewerTimeZone()
  );
  const todayStartIso = startOfToday.toISOString();
  const tomorrowStartIso = startOfTomorrow.toISOString();

  const [
    { data: overduePickups, count: overduePickupsCount },
    { data: overdueDeliveries, count: overdueDeliveriesCount },
    { data: unassignedLoads, count: unassignedCount },
    { data: todaysPickups, count: todaysPickupsCount },
    { data: todaysDeliveries, count: todaysDeliveriesCount },
    { data: deliveredLoads },
    { data: paymentsData },
    { data: summary },
    { count: activeDriverCount },
    { count: inProgressLoadCount },
  ] = await Promise.all([
    // Action-required: assigned but pickup time has already passed —
    // should have moved to in_transit by now.
    supabase
      .from("loads")
      .select(LOAD_PREVIEW_COLUMNS, { count: "exact" })
      .eq("status", "assigned")
      .not("pickup_at", "is", null)
      .lt("pickup_at", nowIso)
      .order("pickup_at", { ascending: true })
      .limit(LIST_LIMIT),
    // Action-required: in transit but dropoff time has already passed —
    // should have been delivered by now.
    supabase
      .from("loads")
      .select(LOAD_PREVIEW_COLUMNS, { count: "exact" })
      .eq("status", "in_transit")
      .not("dropoff_at", "is", null)
      .lt("dropoff_at", nowIso)
      .order("dropoff_at", { ascending: true })
      .limit(LIST_LIMIT),
    // driver_id IS NULL, not status = 'unassigned' — editing a load can
    // clear its driver without the status column reverting to
    // 'unassigned' (a real gap, tracked in ROADMAP.md for later cleanup),
    // so this is the query that actually catches every load needing a
    // driver. Cancelled loads don't need one.
    supabase
      .from("loads")
      .select(LOAD_PREVIEW_COLUMNS, { count: "exact" })
      .is("driver_id", null)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT),
    supabase
      .from("loads")
      .select(LOAD_PREVIEW_COLUMNS, { count: "exact" })
      .neq("status", "cancelled")
      .neq("status", "delivered")
      .gte("pickup_at", todayStartIso)
      .lt("pickup_at", tomorrowStartIso)
      .order("pickup_at", { ascending: true })
      .limit(LIST_LIMIT),
    supabase
      .from("loads")
      .select(LOAD_PREVIEW_COLUMNS, { count: "exact" })
      .neq("status", "cancelled")
      .neq("status", "delivered")
      .gte("dropoff_at", todayStartIso)
      .lt("dropoff_at", tomorrowStartIso)
      .order("dropoff_at", { ascending: true })
      .limit(LIST_LIMIT),
    // Same "delivered loads minus loads with a payment" logic as the
    // Payroll page's "Awaiting payment" section — this preview and that
    // page should never disagree about what's outstanding.
    supabase
      .from("loads")
      .select(
        "id, load_number, client_name, driver_id, driver_pay, delivered_at, drivers ( full_name )"
      )
      .eq("status", "delivered")
      .order("delivered_at", { ascending: false }),
    supabase.from("payments").select("load_id"),
    // Revenue is owner+admin only and scoped to delivered loads — a load
    // that's still in progress could still be cancelled, so counting it
    // would overstate what's actually been earned. dashboard_summary()
    // gates revenue_total/driver_pay_total behind
    // current_user_role() in ('owner','admin') at the database layer
    // (returns null otherwise), same two-layer pattern as the Settings
    // Team section — the app-level `canSeeRevenue` check below on
    // whether to render the section is a second layer on top of that,
    // not the only one.
    supabase.rpc("dashboard_summary").single(),
    // Fleet snapshot — operational counts, not financial, so unlike
    // Revenue these are visible to every role, dispatchers included.
    supabase
      .from("drivers")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    // "In progress" means actively moving (assigned or en route) —
    // deliberately excludes unassigned, which already has its own
    // section below and would just double-count the same loads here.
    supabase
      .from("loads")
      .select("id", { count: "exact", head: true })
      .in("status", ["assigned", "in_transit"]),
  ]);

  const payments = paymentsData ?? [];
  const paidLoadIds = new Set(payments.map((p) => p.load_id));
  const awaitingPayment = (deliveredLoads ?? []).filter(
    (load) => load.driver_id && !paidLoadIds.has(load.id)
  );
  const awaitingPaymentPreview = awaitingPayment.slice(0, LIST_LIMIT);

  // supabase-js has no generated types for this project, so an RPC call
  // comes back untyped ({}) same as every embedded join elsewhere in this
  // file — cast it once here rather than threading `any` through.
  const summaryRow = summary as unknown as {
    revenue_total: number | null;
    driver_pay_total: number | null;
    delivered_loads_count: number | null;
    payments_awaiting_count: number | null;
    payments_awaiting_total: number | null;
  } | null;
  const totalRevenue = Number(summaryRow?.revenue_total ?? 0);
  const totalDriverPay = Number(summaryRow?.driver_pay_total ?? 0);
  const totalMargin = totalRevenue - totalDriverPay;
  const deliveredCount = Number(summaryRow?.delivered_loads_count ?? 0);
  // The SQL-computed count/total from dashboard_summary() — not
  // awaitingPayment.length below, which exists only because the preview
  // rows still need a real fetch; the header number shouldn't be
  // recomputed by hand when the efficient aggregate is right here.
  const awaitingPaymentTrueCount = Number(summaryRow?.payments_awaiting_count ?? 0);
  const awaitingPaymentTrueTotal = Number(summaryRow?.payments_awaiting_total ?? 0);

  const totalOverdue = (overduePickupsCount ?? 0) + (overdueDeliveriesCount ?? 0);
  const totalToday = (todaysPickupsCount ?? 0) + (todaysDeliveriesCount ?? 0);

  return (
    <>
      <DashboardHeader companyName={companyName} profile={profile} />

      {/* Fleet snapshot + quick actions — operational counts everyone can
          see (not financial, so no owner gate), plus a fast path to
          create a load or add a driver without leaving the page. */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <MiniStat label="Active drivers" value={activeDriverCount ?? 0} href="/dashboard/drivers" />
          <MiniStat
            label="Loads in progress"
            value={inProgressLoadCount ?? 0}
            href="/dashboard/loads"
          />
          <MiniStat
            label="Delivered all-time"
            value={deliveredCount}
            href="/dashboard/loads?status=delivered"
          />
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/loads"
            className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            + New load
          </Link>
          <Link
            href="/dashboard/drivers"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            + Add driver
          </Link>
        </div>
      </div>

      {/* 1. Action-required — overdue pickups/deliveries. First because
          it's what a dispatcher opening this page needs to see before
          anything else. */}
      <section className="mt-8">
        <SectionHeading title="Action required" count={totalOverdue} urgent />
        {totalOverdue === 0 ? (
          <EmptyCard text="Nothing overdue — you're all caught up." />
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <PreviewCard>
              <SubHeading>Overdue pickups</SubHeading>
              {(overduePickups as unknown as LoadPreview[] | null)?.length ? (
                <>
                  {(overduePickups as unknown as LoadPreview[]).map((load) => (
                    <LoadRow
                      key={load.id}
                      load={load}
                      right={
                        <span className="font-medium text-red-600 dark:text-red-400">
                          {overdueLabel(load.pickup_at!)}
                        </span>
                      }
                    />
                  ))}
                  {(overduePickupsCount ?? 0) > LIST_LIMIT && (
                    <MoreLink
                      count={(overduePickupsCount ?? 0) - LIST_LIMIT}
                      href="/dashboard/loads?status=assigned"
                    />
                  )}
                </>
              ) : (
                <EmptyRow text="No overdue pickups." />
              )}
            </PreviewCard>
            <PreviewCard>
              <SubHeading>Overdue deliveries</SubHeading>
              {(overdueDeliveries as unknown as LoadPreview[] | null)?.length ? (
                <>
                  {(overdueDeliveries as unknown as LoadPreview[]).map((load) => (
                    <LoadRow
                      key={load.id}
                      load={load}
                      right={
                        <span className="font-medium text-red-600 dark:text-red-400">
                          {overdueLabel(load.dropoff_at!)}
                        </span>
                      }
                    />
                  ))}
                  {(overdueDeliveriesCount ?? 0) > LIST_LIMIT && (
                    <MoreLink
                      count={(overdueDeliveriesCount ?? 0) - LIST_LIMIT}
                      href="/dashboard/loads?status=in_transit"
                    />
                  )}
                </>
              ) : (
                <EmptyRow text="No overdue deliveries." />
              )}
            </PreviewCard>
          </div>
        )}
      </section>

      {/* 2. Unassigned — needs a driver before it can move at all. */}
      <section className="mt-10">
        <SectionHeading title="Unassigned loads" count={unassignedCount ?? 0} />
        <PreviewCard className="mt-3">
          {(unassignedLoads as unknown as LoadPreview[] | null)?.length ? (
            <>
              {(unassignedLoads as unknown as LoadPreview[]).map((load) => (
                <LoadRow
                  key={load.id}
                  load={load}
                  right={
                    load.pickup_at ? (
                      <span className="text-slate-500 dark:text-slate-400">
                        Pickup {new Date(load.pickup_at).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-slate-400 dark:text-slate-500">No pickup time set</span>
                    )
                  }
                />
              ))}
              {(unassignedCount ?? 0) > LIST_LIMIT && (
                <MoreLink
                  count={(unassignedCount ?? 0) - LIST_LIMIT}
                  href="/dashboard/loads?status=unassigned"
                />
              )}
            </>
          ) : (
            <EmptyRow text="Every load has a driver assigned." />
          )}
        </PreviewCard>
      </section>

      {/* 3. Today's pickups/deliveries — informational, capped, no
          view-all link (there's no "today" filter on the Loads page to
          send anyone to). */}
      <section className="mt-10">
        <SectionHeading title="Today" count={totalToday} />
        {totalToday === 0 ? (
          <EmptyCard text="Nothing scheduled for today." />
        ) : (
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <PreviewCard>
              <SubHeading>Pickups</SubHeading>
              {(todaysPickups as unknown as LoadPreview[] | null)?.length ? (
                (todaysPickups as unknown as LoadPreview[]).map((load) => (
                  <LoadRow
                    key={load.id}
                    load={load}
                    right={<span className="text-slate-500 dark:text-slate-400">{formatTime(load.pickup_at!)}</span>}
                  />
                ))
              ) : (
                <EmptyRow text="No pickups scheduled for today." />
              )}
            </PreviewCard>
            <PreviewCard>
              <SubHeading>Deliveries</SubHeading>
              {(todaysDeliveries as unknown as LoadPreview[] | null)?.length ? (
                (todaysDeliveries as unknown as LoadPreview[]).map((load) => (
                  <LoadRow
                    key={load.id}
                    load={load}
                    right={<span className="text-slate-500 dark:text-slate-400">{formatTime(load.dropoff_at!)}</span>}
                  />
                ))
              ) : (
                <EmptyRow text="No deliveries scheduled for today." />
              )}
            </PreviewCard>
          </div>
        )}
      </section>

      {/* 4. Payments awaiting — mirrors Payroll's "Awaiting payment"
          section exactly, so the two never disagree. */}
      <section className="mt-10">
        <SectionHeading title="Payments awaiting" count={awaitingPaymentTrueCount} />
        {awaitingPaymentTrueCount > 0 && (
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {formatCurrency(awaitingPaymentTrueTotal)} owed to drivers.
          </p>
        )}
        <PreviewCard className="mt-3">
          {awaitingPaymentPreview.length ? (
            <>
              {awaitingPaymentPreview.map((load) => (
                <div
                  key={load.id}
                  className="flex items-center justify-between gap-4 px-5 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/loads/${load.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {load.load_number} — {load.client_name}
                    </Link>
                    <p className="mt-0.5 truncate text-slate-500 dark:text-slate-400">
                      {(load.drivers as unknown as { full_name: string } | null)?.full_name ??
                        "—"}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(Number(load.driver_pay))}
                  </span>
                </div>
              ))}
              {awaitingPaymentTrueCount > LIST_LIMIT && (
                <MoreLink
                  count={awaitingPaymentTrueCount - LIST_LIMIT}
                  href="/dashboard/payroll"
                  label="View all in Payroll"
                />
              )}
            </>
          ) : (
            <EmptyRow text="Every delivered load has a payment queued." />
          )}
        </PreviewCard>
      </section>

      {/* 5. Revenue — owner+admin only, delivered loads only. */}
      {canSeeRevenue && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Revenue
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
            Delivered loads only — a load in progress could still be
            cancelled, so it isn&apos;t counted until it&apos;s complete.
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <StatTile
              label="Revenue billed"
              value={formatCurrency(totalRevenue)}
              href="/dashboard/loads?status=delivered"
            />
            <StatTile
              label="Driver compensation"
              value={formatCurrency(totalDriverPay)}
              href="/dashboard/loads?status=delivered"
            />
            <StatTile
              label="Contribution margin"
              value={formatCurrency(totalMargin)}
              href="/dashboard/loads?status=delivered"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
            {deliveredCount} delivered load{deliveredCount === 1 ? "" : "s"}{" "}
            behind these numbers.
          </p>
        </section>
      )}
    </>
  );
}

// ============================================================================
// presentational helpers
// ============================================================================

function DashboardHeader({
  companyName,
  profile,
}: {
  companyName?: string | null;
  profile: { full_name: string | null; role: string } | null;
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {companyName ?? "Your workspace"}
      </h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Logged in as {profile?.full_name ?? "—"} ({profile?.role})
      </p>
    </>
  );
}

function OnboardingBanner() {
  return (
    <div className="mt-8 rounded-xl border border-dashed border-brand-300 bg-brand-50 p-8 text-center dark:border-brand-500/30 dark:bg-brand-500/10">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Welcome to Corridor</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">
        Add a driver and create your first load to get moving — this page
        fills in with what needs your attention once you have loads on the
        board.
      </p>
      <div className="mt-5 flex justify-center gap-3">
        <Link
          href="/dashboard/drivers"
          className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          Add a driver
        </Link>
        <Link
          href="/dashboard/loads"
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Create a load
        </Link>
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  count,
  urgent,
}: {
  title: string;
  count: number;
  urgent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
      {count > 0 && (
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            urgent
              ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
          }`}
        >
          {count}
        </span>
      )}
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="border-b border-slate-100 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:text-slate-500">
      {children}
    </h3>
  );
}

function PreviewCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {children}
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <p className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
      {text}
    </p>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <p className="px-5 py-6 text-center text-sm text-slate-600 dark:text-slate-400">{text}</p>
  );
}

function LoadRow({ load, right }: { load: LoadPreview; right: React.ReactNode }) {
  const driverName = load.drivers?.full_name;
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-3 text-sm last:border-b-0 dark:border-slate-800">
      <div className="min-w-0">
        <Link
          href={`/dashboard/loads/${load.id}`}
          className="font-medium text-brand-700 hover:underline dark:text-brand-400"
        >
          {load.load_number} — {load.client_name}
        </Link>
        <p className="mt-0.5 truncate text-slate-500 dark:text-slate-400">
          {load.pickup_location} → {load.dropoff_location}
          {driverName ? ` · ${driverName}` : ""}
        </p>
      </div>
      <span className="shrink-0 text-xs">{right}</span>
    </div>
  );
}

function MoreLink({
  count,
  href,
  label,
}: {
  count: number;
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      className="block border-t border-slate-100 px-5 py-2.5 text-center text-xs font-medium text-brand-700 hover:bg-slate-50 hover:underline dark:border-slate-800 dark:text-brand-400 dark:hover:bg-slate-800"
    >
      {label ?? "View all"} (+{count} more)
    </Link>
  );
}

function MiniStat({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-baseline gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm transition hover:border-brand-500 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500"
    >
      <span className="font-semibold text-slate-900 dark:text-slate-100">{value}</span>
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
    </Link>
  );
}

function StatTile({
  label,
  value,
  href,
}: {
  label: string;
  value: string | number;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
    </>
  );
  const className =
    "rounded-xl border border-slate-200 bg-white p-6 transition hover:border-brand-500 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900";

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

// ============================================================================
// formatting helpers (local to this page — not currency, so not in lib/format)
// ============================================================================

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function overdueLabel(iso: string) {
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (hours < 24) return `${Math.max(hours, 1)}h overdue`;
  return `${Math.floor(hours / 24)}d overdue`;
}
