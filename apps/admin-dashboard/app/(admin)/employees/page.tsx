import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import { EmployeesTable, type EmployeeRow } from "./EmployeesTable";

export default async function EmployeesPage() {
  const supabase = await createClient();

  const [{ data: employees, error }, { data: roles }, { data: memberships }] = await Promise.all([
    supabase.from("employees").select("*, roles(name)").order("full_name"),
    supabase.from("roles").select("id, name").order("name"),
    supabase.from("employee_companies").select("employee_id, companies(name)"),
  ]);

  const companyNamesByEmployee: Record<string, string[]> = {};
  for (const m of memberships ?? []) {
    const name = (m.companies as { name?: string } | null)?.name;
    if (!name) continue;
    (companyNamesByEmployee[m.employee_id] ??= []).push(name);
  }

  const rows: EmployeeRow[] = (employees ?? []).map((e) => ({
    id: e.id,
    full_name: e.full_name,
    username: e.username,
    job_role: e.job_role,
    status: e.status,
    phone: e.phone,
    department: e.department,
    accessRoleId: e.access_role_id,
    companyNames: companyNamesByEmployee[e.id] ?? [],
    roleName: (e.roles as { name?: string } | null)?.name ?? "—",
  }));

  return (
    <div>
      <PageHeader title="Employees" subtitle="Manage login credentials and company assignment" />

      {error && (
        <div className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          Couldn&apos;t load employees — connect Supabase to see live data.
        </div>
      )}

      {!error && <EmployeesTable employees={rows} roles={roles ?? []} />}
    </div>
  );
}
