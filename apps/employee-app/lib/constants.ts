// Cookie set once an employee's login geofence check passes (see
// app/login/actions.ts), naming which site their session is pinned to —
// read again by Home/Attendance to show only that site. Plain constant,
// not a server action — kept out of any "use server" file, which may only
// export async functions.
export const ACTIVE_SITE_COOKIE = "macro_active_site_id";
