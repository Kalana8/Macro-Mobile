"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";
import { firstAvailableAppRoute, hasAnyAppAccess } from "@macro/shared/rbac";
import type { RolePermissions } from "@macro/shared/types";
import { LOGIN_AT_COOKIE } from "@/lib/constants";

export interface LoginState {
  error?: string;
}

// Marks the moment a login finishes — middleware.ts uses this to force a
// sign-out ~2 hours later regardless of activity, since Supabase's own
// session otherwise stays alive indefinitely via silent refresh.
async function markLoggedIn() {
  const cookieStore = await cookies();
  cookieStore.set(LOGIN_AT_COOKIE, String(Date.now()), { httpOnly: true, sameSite: "lax", path: "/" });
}

/**
 * Login is just credentials + app-access permission — no location/site
 * check here. Geofencing happens later, at Clock In for whichever specific
 * site the employee navigates to (see attendance/actions.ts), which
 * re-verifies server-side regardless of what the client claims.
 */
export async function verifyCredentialsAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) return { error: "Incorrect email or password." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in failed. Please try again." };

  const { data: employee } = await supabase
    .from("employees")
    .select("id, access_role_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!employee) {
    await supabase.auth.signOut();
    return { error: "No employee profile is linked to this account yet. Contact your admin." };
  }

  const { data: role } = await supabase
    .from("roles")
    .select("permissions")
    .eq("id", employee.access_role_id)
    .maybeSingle();
  const permissions = (role?.permissions as RolePermissions | undefined) ?? null;

  if (!hasAnyAppAccess(permissions)) {
    await supabase.auth.signOut();
    return { error: "This account doesn't have mobile app access. Use the Admin Dashboard instead." };
  }

  await markLoggedIn();
  redirect(firstAvailableAppRoute(permissions));
}
