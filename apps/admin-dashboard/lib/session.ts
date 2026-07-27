import { createClient } from "@macro/shared/supabase/server";
import type { Employee, Role } from "@macro/shared/types";

export interface CurrentAdmin {
  authUserId: string;
  employee: Employee | null;
  role: Role | null;
}

export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const supabase = await createClient();

  let user;
  try {
    const {
      data: { user: fetchedUser },
    } = await supabase.auth.getUser();
    user = fetchedUser;
  } catch {
    return null; // Supabase unreachable (e.g. placeholder config)
  }

  if (!user) return null;

  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  let role: Role | null = null;
  if (employee) {
    const { data: roleRow } = await supabase
      .from("roles")
      .select("*")
      .eq("id", employee.access_role_id)
      .maybeSingle();
    role = roleRow ?? null;
  }

  return { authUserId: user.id, employee: employee ?? null, role };
}
