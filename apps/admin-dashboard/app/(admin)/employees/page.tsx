import { createClient } from "@macro/shared/supabase/server";
import { todayInBusinessTimezone } from "@macro/shared/datetime";
import { checkState, type EmployeeCheck } from "@/lib/checks";
import { PageHeader } from "@/components/ui";
import { EmployeesTable, type EmployeeRow } from "./EmployeesTable";

export default async function EmployeesPage() {
  const supabase = await createClient();

  const [{ data: employees, error }, { data: roles }, { data: memberships }, { data: tokens }, { data: submissions }, { data: checkTypes }, { data: checks }] = await Promise.all([
    supabase.from("employees").select("*, roles(name)").order("full_name"),
    supabase.from("roles").select("id, name").order("name"),
    supabase.from("employee_companies").select("employee_id, companies(name)"),
    supabase.from("induction_tokens").select("id, employee_id, status").neq("status", "revoked"),
    supabase.from("induction_submissions").select("token_id, status, created_at").order("created_at", { ascending: false }),
    // Both missing until migration 0057; the Checks column then shows "—".
    supabase.from("check_types").select("id, name").eq("active", true).order("sort").order("name"),
    supabase.from("employee_checks").select("employee_id, check_type_id, status, expires_on"),
  ]);

  // Inductions: one per invitation still in play; done once completed or approved.
  const latestSubmission = new Map<string, string>();
  for (const s of submissions ?? []) if (!latestSubmission.has(s.token_id)) latestSubmission.set(s.token_id, s.status);
  const inductionsByEmployee: Record<string, { done: number; total: number; toReview: number }> = {};
  for (const t of tokens ?? []) {
    const sub = latestSubmission.get(t.id);
    const i = (inductionsByEmployee[t.employee_id] ??= { done: 0, total: 0, toReview: 0 });
    i.total += 1;
    if (sub === "approved" || sub === "completed" || (t.status === "completed" && sub !== "pending_approval")) i.done += 1;
    else if (sub === "pending_approval") i.toReview += 1;
  }

  const today = todayInBusinessTimezone();
  const checkByKey = new Map((checks ?? []).map((c) => [`${c.employee_id}:${c.check_type_id}`, c as Pick<EmployeeCheck, "status" | "expires_on">]));

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
    inductions: inductionsByEmployee[e.id] ?? { done: 0, total: 0, toReview: 0 },
    checks: (checkTypes ?? []).map((t) => ({ name: t.name as string, state: checkState(checkByKey.get(`${e.id}:${t.id}`), today) })),
    accessRoleId: e.access_role_id,
    ownPassword: e.must_change_password === false,
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
