"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";
import type { RolePermissions } from "@macro/shared/types";

export interface RoleFormState {
  error?: string;
  success?: boolean;
}

export async function saveRoleAction(_prev: RoleFormState, formData: FormData): Promise<RoleFormState> {
  const roleId = String(formData.get("roleId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const permissionsRaw = String(formData.get("permissionsJson") ?? "{}");

  if (!name) return { error: "Role name is required." };

  let permissions: RolePermissions;
  try {
    permissions = JSON.parse(permissionsRaw);
  } catch {
    return { error: "Invalid permissions data." };
  }

  const supabase = await createClient();
  const { error } = roleId
    ? await supabase.from("roles").update({ name, permissions }).eq("id", roleId)
    : await supabase.from("roles").insert({ name, permissions, is_system: false, is_admin: false });

  if (error) return { error: error.message };

  revalidatePath("/roles-access");
  return { success: true };
}

export async function deleteRoleAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("roles").delete().eq("id", id);
  revalidatePath("/roles-access");
}
