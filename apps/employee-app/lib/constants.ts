// Cookie set once an employee's login geofence check passes (see
// app/login/actions.ts), naming which site their session is pinned to —
// read again by Home/Attendance to show only that site. Plain constant,
// not a server action — kept out of any "use server" file, which may only
// export async functions.
export const ACTIVE_SITE_COOKIE = "macro_active_site_id";

// Timestamp (ms since epoch) set once at login — Supabase's own session
// otherwise stays alive indefinitely via silent refresh, so this is what
// middleware.ts checks to force a sign-out ~2 hours after login regardless
// of activity.
export const LOGIN_AT_COOKIE = "macro_login_at";
export const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;
