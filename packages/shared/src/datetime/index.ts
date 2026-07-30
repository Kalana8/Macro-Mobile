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
