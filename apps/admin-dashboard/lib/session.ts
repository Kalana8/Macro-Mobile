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

  // One joined query instead of two sequential round-trips — this runs on
  // every admin page navigation (via the (admin) layout), so halving its
  // latency has a broad, felt effect on the whole dashboard.
  const { data: row } = await supabase
    .from("employees")
    .select("*, roles(*)")
    .eq("id", user.id)
    .maybeSingle();

  if (!row) return { authUserId: user.id, employee: null, role: null };

  // The untyped Supabase client can't tell this embed is a to-one
  // relationship (employees.access_role_id -> roles.id), so it may come
  // back as an array or a single object depending on inference — handle
  // both rather than assuming one.
  const { roles, ...employee } = row as unknown as Employee & { roles: Role | Role[] | null };
  const role = Array.isArray(roles) ? (roles[0] ?? null) : roles;
  return { authUserId: user.id, employee: employee as Employee, role };
}
