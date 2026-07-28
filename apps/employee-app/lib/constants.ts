// Timestamp (ms since epoch) set once at login — Supabase's own session
// otherwise stays alive indefinitely via silent refresh, so this is what
// middleware.ts checks to force a sign-out ~2 hours after login regardless
// of activity.
export const LOGIN_AT_COOKIE = "macro_login_at";
export const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000;
