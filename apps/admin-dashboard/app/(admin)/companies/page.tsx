import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import { CompaniesTable, type CompanyEmployeeRow } from "./CompaniesTable";

export default async function CompaniesPage() {
  const supabase = await createClient();
  const [{ data: companies, error }, { data: memberships }, { data: checklists }, { data: allEmployees }, { data: sites }] =
    await Promise.all([
      supabase.from("companies").select("*").order("name"),
      supabase
        .from("employee_companies")
        .select("company_id, employees(id, full_name, job_role, status)"),
      supabase.from("checklists").select("employee_id, status"),
      supabase.from("employees").select("id, full_name").order("full_name"),
      supabase.from("sites").select("company_id, name").order("name"),
    ]);

  const siteNamesByCompany: Record<string, string[]> = {};
  for (const s of sites ?? []) {
    (siteNamesByCompany[s.company_id] ??= []).push(s.name);
  }

  const checklistSummaryByEmployee = new Map<string, { total: number; submitted: number }>();
  for (const c of checklists ?? []) {
    const existing = checklistSummaryByEmployee.get(c.employee_id) ?? { total: 0, submitted: 0 };
    existing.total += 1;
    if (c.status === "submitted") existing.submitted += 1;
    checklistSummaryByEmployee.set(c.employee_id, existing);
  }

  const employeeCounts: Record<string, number> = {};
  const companyEmployees: Record<string, CompanyEmployeeRow[]> = {};
  for (const m of memberships ?? []) {
    const employee = m.employees as unknown as
      | { id: string; full_name: string; job_role: string; status: string }
      | null;
    if (!employee) continue;
    employeeCounts[m.company_id] = (employeeCounts[m.company_id] ?? 0) + 1;
    const summary = checklistSummaryByEmployee.get(employee.id);
    (companyEmployees[m.company_id] ??= []).push({
      id: employee.id,
      name: employee.full_name,
      role: employee.job_role,
      checklistSummary: summary ? `${summary.submitted}/${summary.total} submitted` : "No checklists",
    });
  }

  return (
    <div>
      <PageHeader title="Companies" subtitle="Register and manage client companies" />

      {error && (
        <div className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          Couldn&apos;t load companies — connect Supabase to see live data.
        </div>
      )}

      {!error && (
        <CompaniesTable
          companies={companies ?? []}
          employeeCounts={employeeCounts}
          companyEmployees={companyEmployees}
          allEmployees={allEmployees ?? []}
          siteNamesByCompany={siteNamesByCompany}
        />
      )}
    </div>
  );
}
