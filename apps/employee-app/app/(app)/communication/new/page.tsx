import { createClient } from "@macro/shared/supabase/server";
import { getCurrentEmployee } from "@/lib/session";
import { ScreenHeader } from "@/components/ui";
import { NewReportForm } from "./NewReportForm";

export default async function NewCommunicationPage() {
  const supabase = await createClient();
  const session = await getCurrentEmployee();

  // RLS scopes these to this employee's own assigned companies/sites —
  // employee_companies/employees are additionally scoped to companies this
  // employee shares, so the picker only ever offers real company-mates.
  const [{ data: companies }, { data: sites }, { data: memberships }, { data: employees }] = await Promise.all([
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("sites").select("id, name, company_id").order("name"),
    supabase.from("employee_companies").select("employee_id, company_id"),
    supabase.from("employees").select("id, full_name").order("full_name"),
  ]);

  const employeesById = new Map((employees ?? []).map((e) => [e.id, e]));
  const employeeOptions = (memberships ?? [])
    .map((m) => {
      const employee = employeesById.get(m.employee_id);
      return employee ? { id: employee.id, full_name: employee.full_name, companyId: m.company_id } : null;
    })
    .filter((e): e is { id: string; full_name: string; companyId: string } => Boolean(e));

  return (
    <div>
      <ScreenHeader title="Send" backHref="/communication" />
      <div className="p-5">
        <NewReportForm
          companies={companies ?? []}
          sites={sites ?? []}
          employees={employeeOptions}
          currentEmployeeId={session?.employee?.id ?? ""}
          currentEmployeeName={session?.employee?.full_name ?? "You"}
        />
      </div>
    </div>
  );
}
