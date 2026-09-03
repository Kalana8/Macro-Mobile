import { cache } from "react";
import { createClient } from "@macro/shared/supabase/server";
import type { Employee, Role } from "@macro/shared/types";

export interface CurrentEmployee {
  authUserId: string;
  employee: Employee | null;
  role: Role | null;
}

/**
 * Loads the signed-in Supabase user plus their `employees` profile row and
 * resolved `roles` permissions. Returns `employee: null` if the auth user
 * has no matching employee row yet (e.g. Supabase Auth user created but the
 * employees table insert hasn't run — surfaced as a friendly message by
 * callers rather than a crash).
 *
 * Wrapped in React's `cache()` — several pages call this in addition to the
 * shared (app) layout already calling it once per request, and without this
 * each call would independently re-hit the database rather than reusing the
 * same result within a single render pass.
 */
export const getCurrentEmployee = cache(async (): Promise<CurrentEmployee | null> => {
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
  // every navigation (via the (app) layout, and again on several pages), so
  // halving its latency has a broad, felt effect on the whole app.
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
});
