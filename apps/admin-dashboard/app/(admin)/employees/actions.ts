"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@macro/shared/supabase/server";

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

  revalidatePath("/employees");
  return { success: true };
}

export async function deleteEmployeeAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id || !process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  const admin = createServiceRoleClient();
  await admin.auth.admin.deleteUser(id); // employees row cascades via FK on delete

  revalidatePath("/employees");
}
