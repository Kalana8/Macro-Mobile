import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import type { Role } from "@macro/shared/types";
import { RolesTable } from "./RolesTable";

export default async function RolesAccessPage() {
  const supabase = await createClient();
  const [{ data: roles, error }, { data: employeeCounts }] = await Promise.all([
    supabase.from("roles").select("*").order("created_at"),
    supabase.from("employees").select("access_role_id"),
  ]);

  const countsByRole: Record<string, number> = {};
  for (const e of employeeCounts ?? []) {
    countsByRole[e.access_role_id] = (countsByRole[e.access_role_id] ?? 0) + 1;
  }

  return (
    <div>
      <PageHeader title="Roles & Access" subtitle="Control which pages each role can open in the App and the Dashboard" />

      {error && (
        <div className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          Couldn&apos;t load roles — connect Supabase to see live data.
        </div>
      )}

      {!error && <RolesTable roles={(roles ?? []) as Role[]} employeeCounts={countsByRole} />}
    </div>
  );
}
