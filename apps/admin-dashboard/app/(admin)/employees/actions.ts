"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@macro/shared/supabase/server";
import { getCurrentAdmin } from "@/lib/session";
import { openPassword, sealPassword } from "@/lib/tempPassword";

export interface EmployeeFormState {
  error?: string;
  success?: boolean;
}

/**
 * Provisions a Supabase Auth user (service-role only — requires
 * SUPABASE_SERVICE_ROLE_KEY, see apps/admin-dashboard/.env.example) and
 * links it to a new `employees` profile row. This is the "Create Login"
 * action from the Add Employee modal in the prototype.
 */
export async function createEmployeeAction(
  _prev: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const jobRole = String(formData.get("jobRole") ?? "").trim();
  const accessRoleId = String(formData.get("accessRoleId") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!fullName || !username || !password) {
    return { error: "Name, username and password are required." };
  }
  if (!accessRoleId) return { error: "Select an access role." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY isn't configured — add it to .env.local to provision employee logins.",
    };
  }

  const admin = createServiceRoleClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: username,
    password,
    email_confirm: true,
  });

  if (createError || !created.user) {
    return { error: createError?.message ?? "Couldn't create the login." };
  }

  const supabase = await createClient();
  const { error: insertError } = await supabase.from("employees").insert({
    id: created.user.id,
    full_name: fullName,
    username,
    job_role: jobRole,
    access_role_id: accessRoleId,
    status: "active",
    must_change_password: true,
  });

  if (insertError) {
    // Roll back the orphaned auth user so retrying doesn't collide on email.
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: insertError.message };
  }
  await keepTempPassword(created.user.id, password);

  revalidatePath("/employees");
  return { success: true };
}

/**
 * Edits an employee's profile fields and, optionally, resets their
 * password (service-role only, same as createEmployeeAction). A reset
 * also flips must_change_password back on so the employee is forced to
 * pick their own new password at next login, matching the same flow new
 * logins already go through.
 */
export async function updateEmployeeAction(
  _prev: EmployeeFormState,
  formData: FormData
): Promise<EmployeeFormState> {
  const id = String(formData.get("id") ?? "");
  const fullName = String(formData.get("fullName") ?? "").trim();
  const jobRole = String(formData.get("jobRole") ?? "").trim();
  const accessRoleId = String(formData.get("accessRoleId") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  const status = String(formData.get("status") ?? "active");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmNewPassword = String(formData.get("confirmNewPassword") ?? "");

  if (!id || !fullName || !username) return { error: "Name and username are required." };
  if (!accessRoleId) return { error: "Select an access role." };

  if (newPassword || confirmNewPassword) {
    if (newPassword.length < 8) return { error: "New password must be at least 8 characters." };
    if (newPassword !== confirmNewPassword) return { error: "New passwords do not match." };
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      error: "SUPABASE_SERVICE_ROLE_KEY isn't configured — add it to .env.local to manage employee logins.",
    };
  }

  const admin = createServiceRoleClient();
  const authUpdate: { email?: string; password?: string } = { email: username };
  if (newPassword) authUpdate.password = newPassword;

  const { error: authError } = await admin.auth.admin.updateUserById(id, authUpdate);
  if (authError) return { error: authError.message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("employees")
    .update({
      full_name: fullName,
      job_role: jobRole,
      access_role_id: accessRoleId,
      username,
      status,
      ...(newPassword ? { must_change_password: true } : {}),
    })
    .eq("id", id);

  if (error) return { error: error.message };
  if (newPassword) await keepTempPassword(id, newPassword);

  revalidatePath("/employees");
  return { success: true };
}

/**
 * Keeps an encrypted copy of the temporary password for the Employees page
 * (migration 0063). Before that migration the table is missing and this
 * quietly does nothing.
 */
async function keepTempPassword(employeeId: string, password: string) {
  try {
    const admin = createServiceRoleClient();
    await admin.from("employee_temp_passwords").upsert({ employee_id: employeeId, secret: sealPassword(password), created_at: new Date().toISOString() });
  } catch {
    // Never block creating or resetting a login over this.
  }
}

export interface TempPasswordResult {
  password?: string;
  /** "changed": they've set their own; "unreadable": reset to see one again; "unavailable": migration 0063 not run. */
  status: "ok" | "changed" | "unreadable" | "unavailable" | "denied";
}

/** The temporary password of one employee, for admins only. */
export async function getTempPasswordAction(employeeId: string): Promise<TempPasswordResult> {
  const me = await getCurrentAdmin();
  if (!me?.role?.is_admin) return { status: "denied" };
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { status: "unavailable" };
  const admin = createServiceRoleClient();
  const { data, error } = await admin.from("employee_temp_passwords").select("secret").eq("employee_id", employeeId).maybeSingle();
  if (error) return { status: "unavailable" };
  if (!data) return { status: "changed" };
  const password = openPassword(data.secret as string);
  return password ? { status: "ok", password } : { status: "unreadable" };
}

export async function deleteEmployeeAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const admin = createServiceRoleClient();
  await admin.auth.admin.deleteUser(id); // employees row cascades via FK on delete

  revalidatePath("/employees");
}
