import Link from "next/link";
import { createClient } from "@macro/shared/supabase/server";
import { todayInBusinessTimezone } from "@macro/shared/datetime";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

export default async function AttendancePage() {
  const supabase = await createClient();
  const today = todayInBusinessTimezone();

  const [{ data: companies }, { data: memberships }, { data: employees }, { data: todayRecords }] =
    await Promise.all([
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("employee_companies").select("employee_id, company_id"),
      supabase.from("employees").select("id, full_name, job_role").order("full_name"),
      supabase.from("attendance").select("employee_id, status").eq("date", today),
    ]);

  const employeesById = new Map((employees ?? []).map((e) => [e.id, e]));
  const statusByEmployee = new Map((todayRecords ?? []).map((r) => [r.employee_id, r.status]));

  const employeeIdsByCompany = new Map<string, string[]>();
  for (const m of memberships ?? []) {
    const list = employeeIdsByCompany.get(m.company_id) ?? [];
    list.push(m.employee_id);
    employeeIdsByCompany.set(m.company_id, list);
  }

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Pick an employee to see their daily/weekly attendance" />

      {(companies?.length ?? 0) === 0 ? (
        <EmptyState title="No companies yet" />
      ) : (
        <div className="flex flex-col gap-5">
          {companies!.map((company) => {
            const employeeIds = employeeIdsByCompany.get(company.id) ?? [];
            const companyEmployees = employeeIds
              .map((id) => employeesById.get(id))
              .filter((e): e is { id: string; full_name: string; job_role: string | null } => Boolean(e));

            return (
              <Card key={company.id}>
                <div className="mb-3 text-[15px] font-bold text-text-dark">{company.name}</div>
                {companyEmployees.length === 0 ? (
                  <div className="text-xs text-text-muted">No employees assigned to this company yet.</div>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {companyEmployees.map((employee) => {
                      const status = statusByEmployee.get(employee.id);
                      return (
                        <Link
                          key={employee.id}
                          href={`/attendance/${employee.id}`}
                          className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div>
                            <div className="text-sm font-semibold text-text-dark">{employee.full_name}</div>
                            {employee.job_role && <div className="text-xs text-text-muted">{employee.job_role}</div>}
                          </div>
                          <div className="flex items-center gap-2">
                            {status && (
                              <Badge tone={status === "complete" ? "success" : "warning"}>
                                {status === "complete" ? "Clocked Out" : status === "on_break" ? "On Break" : "Clocked In"}
                              </Badge>
                            )}
                            <span className="text-text-muted">→</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
