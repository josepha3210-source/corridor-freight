import { cookies } from "next/headers";

/**
 * "Today" for dashboard queries has to mean the viewer's local calendar
 * day, not the server's — a dispatcher in Denver and one wherever the
 * server happens to run need different results once it's already
 * tomorrow for one of them. There's no HTTP header that carries a
 * browser's timezone, so the only way the server can know it is a
 * cookie set client-side (see components/TimezoneSync.tsx) — this just
 * reads it back, falling back to UTC on the very first request ever,
 * before that cookie exists.
 */
export function getViewerTimeZone(): string {
  return cookies().get("tz")?.value || "UTC";
}

/**
 * The UTC instant for local midnight in an arbitrary IANA zone depends
 * on that zone's UTC offset *on that specific date* (DST-aware) — there
 * is no shortcut without a timezone library. This does the standard
 * trick instead: guess an instant, ask Intl what that instant reads as
 * in the target zone, and correct by the difference. (JS Date's UTC
 * constructor normalizes out-of-range fields on its own, so passing
 * day 32 correctly rolls into next month — that's what lets
 * getTodayRangeInTimeZone below compute "tomorrow" by just adding 1 to
 * the day number.)
 */
function zonedDateToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  timeZone: string
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);

  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
      .formatToParts(new Date(utcGuess))
      .map((p) => [p.type, p.value])
  );

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    parts.hour === "24" ? 0 : Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  const offset = asIfUtc - utcGuess;
  return new Date(utcGuess - offset);
}

/** [start, end) UTC bounds for "today" as seen from the given IANA timezone. */
export function getTodayRangeInTimeZone(timeZone: string): {
  start: Date;
  end: Date;
} {
  const now = new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );

  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);

  return {
    start: zonedDateToUtc(year, month, day, timeZone),
    end: zonedDateToUtc(year, month, day + 1, timeZone),
  };
}
