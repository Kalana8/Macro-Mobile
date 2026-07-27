"use server";

import { redirect } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";
import { hasAnyDashboardAccess } from "@macro/shared/rbac";
import type { RolePermissions } from "@macro/shared/types";

export interface LoginState {
  error?: string;
}

// No geofence gate here — Architecture Document §3: "Admin login is exempt
// (desk-based role)." Dashboard access is gated on the account's role
// having ANY dashboard-side permission enabled — not just the Dashboard
// overview page — so roles like Supervisor (Attendance/Audits/Checklists/
// Communication access, per Appendix C) can still sign in here even
// without the overview page itself enabled.
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
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
    .select("access_role_id")
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

  const permissions = role?.permissions as RolePermissions | undefined;

  if (!hasAnyDashboardAccess(permissions)) {
    await supabase.auth.signOut();
    return { error: "This account doesn't have Admin Dashboard access." };
  }

  // Land on the Dashboard overview if enabled, otherwise the first area
  // this role actually has access to (e.g. a Supervisor without the
  // overview page lands on Attendance instead of a page they can't use).
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
  const firstAvailable = AREA_ROUTES.find(([area]) =>
    Object.values(permissions!.dashboard[area] as Record<string, boolean>).some(Boolean)
  );

  redirect(firstAvailable?.[1] ?? "/dashboard");
}
