// Both apps' business operations run on Australian time (Sydney/Melbourne/
// Brisbane), but the hosting server (and pg_cron in Supabase) runs in UTC,
// and a viewer's browser could be set to any timezone — every date/time
// shown to a user, or used to decide "today", must anchor to this zone
// explicitly rather than trusting whatever runtime/device happens to render it.
export const BUSINESS_TIMEZONE = "Australia/Sydney";

/** Locale-aware date formatting, pinned to BUSINESS_TIMEZONE regardless of viewer/server timezone. */
export function formatDate(date: Date | string, options: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, { timeZone: BUSINESS_TIMEZONE, ...options });
}

/** Locale-aware time formatting, pinned to BUSINESS_TIMEZONE regardless of viewer/server timezone. */
export function formatTime(date: Date | string, options: Intl.DateTimeFormatOptions = {}): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString(undefined, { timeZone: BUSINESS_TIMEZONE, ...options });
}

/** "Today" as YYYY-MM-DD in BUSINESS_TIMEZONE — for date-input defaults, "today" query filters, and week/day navigation anchors. Using Date.toISOString() instead would shift by the UTC offset and can land on the wrong calendar day. */
export function todayInBusinessTimezone(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIMEZONE }).format(new Date());
}

/** Current hour (0-23) in BUSINESS_TIMEZONE — for time-of-day greetings etc. */
export function currentHourInBusinessTimezone(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", { timeZone: BUSINESS_TIMEZONE, hour: "numeric", hour12: false }).format(new Date())
  );
}

/** How far BUSINESS_TIMEZONE is ahead of UTC at a given instant, in ms. */
function businessOffsetMs(instant: number): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: BUSINESS_TIMEZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    })
      .formatToParts(new Date(instant))
      .map((p) => [p.type, Number(p.value)])
  );
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - instant;
}

/** The instant a calendar day starts in BUSINESS_TIMEZONE. Checked twice because daylight saving can change between the guess and midnight. */
function businessMidnight(year: number, month: number, day: number): number {
  const wallClock = Date.UTC(year, month - 1, day);
  const guess = wallClock - businessOffsetMs(wallClock);
  return wallClock - businessOffsetMs(guess);
}

/**
 * The ISO instants bounding one or more YYYY-MM-DD business days, for filtering
 * by clock_in_at (start inclusive, end exclusive). attendance.date can't be
 * trusted for this: it defaults to the UTC date, which is the previous day for
 * the first ~11 hours of every Sydney day.
 */
export function businessDayRange(firstDay: string, lastDay: string = firstDay): { start: string; end: string } {
  const [y1, m1, d1] = firstDay.split("-").map(Number);
  const [y2, m2, d2] = lastDay.split("-").map(Number);
  return {
    start: new Date(businessMidnight(y1, m1, d1)).toISOString(),
    end: new Date(businessMidnight(y2, m2, d2 + 1)).toISOString(),
  };
}

/** The YYYY-MM-DD business day an instant falls on. */
export function businessDayOf(iso: string): string {
  const [month, day, year] = new Date(iso)
    .toLocaleDateString("en-US", { timeZone: BUSINESS_TIMEZONE, year: "numeric", month: "numeric", day: "numeric" })
    .match(/\d+/g)!;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}
