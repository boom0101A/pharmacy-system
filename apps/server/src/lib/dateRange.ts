// The pharmacy operates on Baghdad time; Iraq has kept a fixed UTC+3 offset
// with no DST since 2007, so a plain constant is correct (and simpler and more
// auditable than pulling in a full IANA tz library for one offset).
const BAGHDAD_OFFSET_MS = 3 * 60 * 60 * 1000;

/**
 * Resolves an optional from/to query range, defaulting to the last 30 days.
 *
 * `from`/`to` come from a plain <input type="date">, e.g. "2026-01-02", which
 * `Date` parses as UTC midnight for that calendar date. Read literally that
 * would make "today" mean Baghdad's day minus 3 hours at the front and plus 3
 * hours short at the back — a sale made between local midnight and 03:00
 * would fall entirely outside the very "today" window meant to include it, on
 * top of the separate day-bucketing fix in reports.routes.ts. Shifting both
 * ends back by the Baghdad offset re-anchors the same UTC-midnight input to
 * actual Baghdad midnight.
 */
export function resolveRange(from?: Date, to?: Date) {
  // `new Date('abc')` is an Invalid Date, which reaches the driver as NaN and
  // surfaces as a 500. Treat anything unparseable as "not supplied".
  const validFrom = from && !Number.isNaN(from.getTime()) ? from : undefined;
  const validTo = to && !Number.isNaN(to.getTime()) ? to : undefined;

  const end = validTo
    ? new Date(validTo.getTime() + 86_400_000 - 1 - BAGHDAD_OFFSET_MS)
    : new Date();
  const start = validFrom
    ? new Date(validFrom.getTime() - BAGHDAD_OFFSET_MS)
    : new Date(end.getTime() - 30 * 86_400_000);
  return { start, end };
}

/**
 * Baghdad midnight for "now", as a UTC instant — for "today"'s totals
 * (dashboard) where there is no `from`/`to` query input to anchor to.
 * `new Date(); setHours(0,0,0,0)` instead reads the *server's own* system
 * clock/timezone, which on a Windows till is whatever its OS locale happens
 * to be set to, not necessarily Baghdad.
 */
export function startOfTodayBaghdad(now: Date = new Date()): Date {
  const baghdadNow = new Date(now.getTime() + BAGHDAD_OFFSET_MS);
  const baghdadMidnightAsUtc = Date.UTC(
    baghdadNow.getUTCFullYear(),
    baghdadNow.getUTCMonth(),
    baghdadNow.getUTCDate(),
  );
  return new Date(baghdadMidnightAsUtc - BAGHDAD_OFFSET_MS);
}

/** Today's calendar date in Baghdad as "YYYY-MM-DD" — what an expiry date (a plain date) is compared against. */
export function baghdadTodayIso(now: Date = new Date()): string {
  return new Date(now.getTime() + BAGHDAD_OFFSET_MS).toISOString().slice(0, 10);
}
