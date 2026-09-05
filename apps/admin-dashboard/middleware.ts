import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@macro/shared/supabase/middleware";
import { hasAnyDashboardAccess } from "@macro/shared/rbac";
import type { RolePermissions } from "@macro/shared/types";

const PUBLIC_PATHS = ["/login"];

// Public checklist share links (/shared/checklists/[id]) and induction
// invitation links (/induction/[token]) — unlike /login, these must stay
// reachable even when the visitor IS logged in (an admin opening their own
// share/invite link shouldn't get bounced back to /dashboard by the
// isPublic redirect below), so they're checked separately. The induction
// token itself (not a database id) is the only thing gating access to that
// route — see app/induction/[token]/page.tsx.
const ALWAYS_PUBLIC_PREFIXES = ["/shared/", "/induction/"];

const AREA_ROUTES: [keyof RolePermissions["dashboard"], string][] = [
  ["dashboard", "/dashboard"],
  ["companies", "/companies"],
  ["employees", "/employees"],
  ["attendance", "/attendance"],
  ["audits", "/audits"],
  ["checklists", "/checklists"],
  ["communication", "/communication"],
  ["roles", "/roles-access"],
  ["weeklyReports", "/weekly-reports"],
  ["inductions", "/inductions"],
];

function firstAvailableRoute(permissions: RolePermissions): string {
  const match = AREA_ROUTES.find(([area]) =>
    Object.values(permissions.dashboard[area] as Record<string, boolean>).some(Boolean)
  );
  return match?.[1] ?? "/dashboard";
}

export async function middleware(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Server Action POSTs back to the page they were rendered from — if
  // middleware redirects one away, the client gets a redirect response
  // instead of the expected action payload and throws "An unexpected
  // response was received from the server." Server Actions run server-side
  // and finish with their own `redirect()`, so let these through untouched.
  if (request.headers.get("next-action")) {
    return response;
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAlwaysPublic = ALWAYS_PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (isAlwaysPublic) {
    return response;
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    // Coarse gate: does this account's role have ANY dashboard-side
    // permission at all (not just the Dashboard overview page — see
    // hasAnyDashboardAccess). Per-page/function gating (Companies vs.
    // Audits vs. Roles & Access, etc.) is enforced by each page's own
    // read query, which RLS backs regardless of what the UI shows — see
    // supabase/migrations/0002_rls.sql.
    // One joined query instead of two sequential round-trips — this runs on
    // every navigation across the whole dashboard, so it's worth cutting in half.
    const { data: employee } = await supabase
      .from("employees")
      .select("access_role_id, roles(permissions)")
      .eq("id", user.id)
      .maybeSingle();

    // The untyped Supabase client can't tell this embed is a to-one
    // relationship (employees.access_role_id -> roles.id), so its inferred
    // type doesn't match what PostgREST actually returns — handle both
    // shapes defensively rather than asserting one.
    const rolesEmbed = employee?.roles as unknown as { permissions: RolePermissions } | { permissions: RolePermissions }[] | null;
    const permissions = Array.isArray(rolesEmbed) ? rolesEmbed[0]?.permissions : rolesEmbed?.permissions;
    const hasAccess = Boolean(employee) && hasAnyDashboardAccess(permissions);

    if (!hasAccess && !isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("error", "no-access");
      return NextResponse.redirect(url);
    }

    if (hasAccess && isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = firstAvailableRoute(permissions!);
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads/).*)"],
};
