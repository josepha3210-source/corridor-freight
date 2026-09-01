/**
 * Every sidebar item Phase 1 added a real nav link for but that a later
 * phase actually builds — same "honest placeholder, not a fake success
 * state or a dead 404" precedent already set by the HVUT 2290 stub
 * (§78/Phase 5d) and the Stripe-not-configured messaging (§70). The
 * sidebar is fully navigable now; the features fill in behind it
 * incrementally rather than the nav growing one link at a time.
 */
export function ComingSoon({
  title,
  description,
  phase,
}: {
  title: string;
  description: string;
  phase: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h1>
      <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          {description}
        </p>
        <p className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Coming in {phase}
        </p>
      </div>
    </div>
  );
}
