/**
 * How long a company keeps full write access after its subscription
 * first goes `past_due`, before new loads/drivers get blocked (existing
 * records stay fully readable and editable regardless — see the
 * `enforce_payment_write_lock` trigger, migration 0014, for why this is
 * INSERT-only). Named so it's one obvious place to change, not a bare
 * number scattered across the banner and the write-lock check.
 *
 * The actual write-lock enforcement lives in Postgres
 * (`is_write_locked()`, 0014), which can't import this file — that SQL
 * function hardcodes the same 7 and says so in its own comment. Keep
 * both in sync if this ever changes.
 */
export const PAST_DUE_GRACE_PERIOD_DAYS = 7;

export function graceDaysRemaining(pastDueSince: string | null): number | null {
  if (!pastDueSince) return null;
  const elapsedMs = Date.now() - new Date(pastDueSince).getTime();
  const elapsedDays = elapsedMs / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(PAST_DUE_GRACE_PERIOD_DAYS - elapsedDays));
}
