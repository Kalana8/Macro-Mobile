"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";
import { withinGeofence } from "@macro/shared/geo";
import type { RolePermissions } from "@macro/shared/types";
import { ACTIVE_SITE_COOKIE } from "@/lib/constants";

export interface SiteOption {
  id: string;
  name: string;
  address: string;
}

export interface LoginState {
  error?: string;
  /** Set once credentials + role checks pass but more than one site needs picking. */
  sites?: SiteOption[];
  /** The coordinates already captured in step 1, carried into step 2 so we don't ask twice. */
  lat?: number;
  lng?: number;
}

async function loadEmployeeAndPermissions(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: employee } = await supabase
    .from("employees")
    .select("id, access_role_id")
    .eq("id", userId)
    .maybeSingle();
  if (!employee) return { employee: null, permissions: null };

  const { data: role } = await supabase
    .from("roles")
    .select("permissions")
    .eq("id", employee.access_role_id)
    .maybeSingle();

  return { employee, permissions: (role?.permissions as RolePermissions | undefined) ?? null };
}

/**
 * Step 1 — verifies email/password + app-access permission, per
 * Architecture Document §3. If this role clocks in/out in the field
 * (`app.attendance.clockInOut`), it also resolves which of the employee's
 * assigned sites to geofence-check against:
 *   - 0 sites  → reject, nothing to check against.
 *   - 1 site   → check it immediately with the coordinates from this step.
 *   - 2+ sites → hand the list back to the client so they pick which one
 *                they're at today; step 2 (confirmSiteLoginAction) checks
 *                that specific site instead of "any assigned site."
 * On any rejection the session is signed back out — a failed check must
 * never leave a finalized session behind.
 */
export async function verifyCredentialsAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const latRaw = formData.get("lat");
  const lngRaw = formData.get("lng");
  const lat = latRaw ? Number(latRaw) : null;
  const lng = lngRaw ? Number(lngRaw) : null;

  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: "Incorrect email or password." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in failed. Please try again." };

  const { employee, permissions } = await loadEmployeeAndPermissions(supabase, user.id);

  if (!employee) {
    await supabase.auth.signOut();
    return { error: "No employee profile is linked to this account yet. Contact your admin." };
  }
  if (!permissions?.app?.home?.view) {
    await supabase.auth.signOut();
    return { error: "This account doesn't have mobile app access. Use the Admin Dashboard instead." };
  }

  const requiresGeofence = Boolean(permissions.app.attendance?.clockInOut);
  if (!requiresGeofence) {
    redirect("/home");
  }

  if (lat === null || lng === null) {
    await supabase.auth.signOut();
    return { error: "Location access denied. You must be on-site to log in." };
  }

  // RLS scopes this to sites belonging to the employee's assigned companies.
  const { data: sites } = await supabase.from("sites").select("id, name, address, lat, lng").order("name");

  if (!sites || sites.length === 0) {
    await supabase.auth.signOut();
    return { error: "You have no assigned sites yet. Contact your admin." };
  }

  if (sites.length === 1) {
    const site = sites[0];
    if (!withinGeofence(lat, lng, site.lat, site.lng)) {
      await supabase.auth.signOut();
      return { error: `You must be within 20m of ${site.name} to log in.` };
    }
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_SITE_COOKIE, site.id, { httpOnly: true, sameSite: "lax", path: "/" });
    redirect("/home");
  }

  // Multiple sites — let the client render a picker with the coordinates
  // we already captured, then finish in confirmSiteLoginAction.
  return {
    sites: sites.map((s) => ({ id: s.id, name: s.name, address: s.address })),
    lat,
    lng,
  };
}

/** Step 2 — only reached when the employee has more than one assigned site. */
export async function confirmSiteLoginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const siteId = String(formData.get("siteId") ?? "");
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));

  if (!siteId) return { error: "Choose the site you're at." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Log in again." };

  // RLS scopes this to sites belonging to the employee's assigned companies
  // — a stray/foreign siteId simply won't be found.
  const { data: site } = await supabase.from("sites").select("id, name, lat, lng").eq("id", siteId).maybeSingle();
  if (!site) {
    await supabase.auth.signOut();
    return { error: "That site isn't assigned to you." };
  }

  if (!withinGeofence(lat, lng, site.lat, site.lng)) {
    await supabase.auth.signOut();
    return { error: `You must be within 20m of ${site.name} to log in.` };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_SITE_COOKIE, site.id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/home");
}
