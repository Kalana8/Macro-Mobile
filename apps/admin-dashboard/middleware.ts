import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@macro/shared/supabase/middleware";
import { hasAnyDashboardAccess } from "@macro/shared/rbac";
import type { RolePermissions } from "@macro/shared/types";

const PUBLIC_PATHS = ["/login"];

const AREA_ROUTES: [keyof RolePermissions["dashboard"], string][] = [
  ["dashboard", "/dashboard"],
  ["companies", "/companies"],
  ["employees", "/employees"],
  ["attendance", "/attendance"],
  ["audits", "/audits"],
  ["checklists", "/checklists"],
  ["communication", "/communication"],
  ["roles", "/roles-access"],
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
    const { data: employee } = await supabase
      .from("employees")
      .select("access_role_id")
      .eq("id", user.id)
      .maybeSingle();

    const { data: role } = employee
      ? await supabase.from("roles").select("permissions").eq("id", employee.access_role_id).maybeSingle()
      : { data: null };

    const permissions = role?.permissions as RolePermissions | undefined;
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
