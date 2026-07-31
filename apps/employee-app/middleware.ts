import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@macro/shared/supabase/middleware";
import { canViewAppArea, firstAvailableAppRoute } from "@macro/shared/rbac";
import type { RolePermissions } from "@macro/shared/types";
import { LOGIN_AT_COOKIE, SESSION_MAX_AGE_MS } from "@/lib/constants";

const PUBLIC_PATHS = ["/login"];
const CHANGE_PASSWORD_PATH = "/profile/change-password";

// Route prefix(es) each app-side permission area gates, for matching an
// incoming pathname back to its area — /sites/[id] hangs off Home (reached
// by tapping a site card there), so it shares Home's permission rather than
// needing its own. Profile is deliberately NOT listed — it's where Log Out
// lives, and every signed-in account needs a way to log out regardless of
// role (see firstAvailableAppRoute in @macro/shared/rbac, which is what
// actually picks a landing route and treats /profile as the safe fallback).
const AREA_ROUTES: [keyof RolePermissions["app"], string[]][] = [
  ["home", ["/home", "/sites"]],
  ["attendance", ["/attendance"]],
  ["checklists", ["/checklists"]],
  ["audits", ["/audits"]],
  ["communication", ["/communication"]],
];

function areaForPath(pathname: string): keyof RolePermissions["app"] | null {
  for (const [area, prefixes] of AREA_ROUTES) {
    if (prefixes.some((p) => pathname.startsWith(p))) return area;
  }
  return null;
}

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

  if (!user) {
    return response;
  }

  // Supabase's own session otherwise stays alive indefinitely via silent
  // refresh — force a sign-out ~2 hours after login regardless of
  // activity. LOGIN_AT_COOKIE is stamped in app/login/actions.ts; a
  // session predating this feature (no cookie yet) just gets stamped
  // "now" rather than being kicked out immediately.
  if (!isPublic) {
    const loginAtRaw = request.cookies.get(LOGIN_AT_COOKIE)?.value;
    const loginAt = loginAtRaw ? Number(loginAtRaw) : null;

    if (loginAt && Date.now() - loginAt > SESSION_MAX_AGE_MS) {
      await supabase.auth.signOut();
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("reason", "session-expired");
      const redirectResponse = NextResponse.redirect(url);
      redirectResponse.cookies.delete(LOGIN_AT_COOKIE);
      return redirectResponse;
    }

    if (!loginAt) {
      response.cookies.set(LOGIN_AT_COOKIE, String(Date.now()), { httpOnly: true, sameSite: "lax", path: "/" });
    }
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("access_role_id")
    .eq("id", user.id)
    .maybeSingle();

  const { data: role } = employee
    ? await supabase.from("roles").select("permissions").eq("id", employee.access_role_id).maybeSingle()
    : { data: null };
  const permissions = role?.permissions as RolePermissions | undefined;

  if (isPublic) {
    // Logged in and hitting /login — send them to whichever app area their
    // role actually grants (not a hardcoded /home a restricted role might
    // not see).
    // TEMPORARILY REMOVED: forced-change-password-on-first-login redirect.
    // Was: employee?.must_change_password ? CHANGE_PASSWORD_PATH : ...
    const url = request.nextUrl.clone();
    url.pathname = permissions ? firstAvailableAppRoute(permissions) : "/home";
    return NextResponse.redirect(url);
  }

  if (!pathname.startsWith(CHANGE_PASSWORD_PATH)) {
    // TEMPORARILY REMOVED: forced password change on first login. Used to
    // redirect here whenever employee.must_change_password was true — the
    // Change Password page/link are still in the codebase (just unlinked
    // from Profile), so this whole block is easy to restore later.

    const area = areaForPath(pathname);
    if (area && permissions && !canViewAppArea(permissions, area)) {
      const url = request.nextUrl.clone();
      url.pathname = firstAvailableAppRoute(permissions);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|uploads/).*)"],
};
