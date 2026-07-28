import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@macro/shared/supabase/middleware";
import { ACTIVE_SITE_COOKIE, LOGIN_AT_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/constants";

const PUBLIC_PATHS = ["/login"];
const CHANGE_PASSWORD_PATH = "/profile/change-password";

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Server Action calls (e.g. the login page's multi-step flow, which signs
  // the user in on step 1 but doesn't redirect until step 2 confirms the
  // chosen site) POST back to the same page they were rendered from. If
  // middleware redirects one of these away, the client gets a redirect
  // response instead of the expected action payload and throws "An
  // unexpected response was received from the server." Server Actions
  // always run server-side and finish with their own `redirect()`, so
  // there's nothing for this middleware to add here — just let it through.
  if (request.headers.get("next-action")) {
    return response;
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    return NextResponse.redirect(url);
  }

  if (user && !isPublic) {
    // Supabase's own session otherwise stays alive indefinitely via silent
    // refresh — force a sign-out ~2 hours after login regardless of
    // activity. LOGIN_AT_COOKIE is stamped in app/login/actions.ts; a
    // session predating this feature (no cookie yet) just gets stamped
    // "now" rather than being kicked out immediately.
    const loginAtRaw = request.cookies.get(LOGIN_AT_COOKIE)?.value;
    const loginAt = loginAtRaw ? Number(loginAtRaw) : null;

    if (loginAt && Date.now() - loginAt > SESSION_MAX_AGE_MS) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("reason", "session-expired");
      const redirectResponse = NextResponse.redirect(url);
      redirectResponse.cookies.delete(ACTIVE_SITE_COOKIE);
      redirectResponse.cookies.delete(LOGIN_AT_COOKIE);
      return redirectResponse;
    }

    if (!loginAt) {
      response.cookies.set(LOGIN_AT_COOKIE, String(Date.now()), { httpOnly: true, sameSite: "lax", path: "/" });
    }
  }

  if (user && !isPublic && !pathname.startsWith(CHANGE_PASSWORD_PATH)) {
    // Force a password change on first login — the admin sets the initial
    // password when provisioning the account (Employees page), and the
    // employee must set their own before reaching Home/Attendance/etc.
    const { data: employee } = await supabase
      .from("employees")
      .select("must_change_password")
      .eq("id", user.id)
      .maybeSingle();

    if (employee?.must_change_password) {
      const url = request.nextUrl.clone();
      url.pathname = CHANGE_PASSWORD_PATH;
      url.searchParams.set("first", "1");
      return NextResponse.redirect(url);
    }
  }

  // Role-level page gating (which /( app ) routes this employee's role can
  // open) is enforced in app/(app)/layout.tsx once the employee's row +
  // role permissions are loaded — middleware only handles the auth gate
  // here to avoid an extra DB round trip on every request.

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|uploads/).*)"],
};
