import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import type { Checklist, ChecklistTemplate } from "@macro/shared/types";
import { ChecklistsTabs } from "./ChecklistsTabs";

export default async function ChecklistsPage() {
  const supabase = await createClient();

  const [
    { data: checklists },
    { data: templates },
    { data: assignments },
    { data: companies },
    { data: sites },
    { data: employees },
    { data: memberships },
  ] = await Promise.all([
    supabase
      .from("checklists")
      .select("*, companies(name), employees(full_name)")
      .order("assigned_date", { ascending: false })
      .limit(80),
    supabase.from("checklist_templates").select("*, companies(name)").order("created_at", { ascending: false }),
    supabase
      .from("checklist_assignments")
      .select("id, template_id, admin_note, companies(name), employees(full_name), checklist_templates(site)")
      .order("created_at", { ascending: false }),
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("sites").select("id, name, company_id").order("name"),
    supabase.from("employees").select("id, full_name").order("full_name"),
    supabase.from("employee_companies").select("employee_id, company_id"),
  ]);

  const companyIdsByEmployee: Record<string, string[]> = {};
  for (const m of memberships ?? []) {
    (companyIdsByEmployee[m.employee_id] ??= []).push(m.company_id);
  }
  const employeeOptions = (employees ?? []).map((e) => ({
    id: e.id,
    full_name: e.full_name,
    companyIds: companyIdsByEmployee[e.id] ?? [],
  }));

  const joinChecklist = (c: NonNullable<typeof checklists>[number]) => ({
    ...(c as unknown as Checklist),
    companyName: (c.companies as { name?: string } | null)?.name ?? "—",
    employeeName: (c.employees as { full_name?: string } | null)?.full_name ?? "—",
  });

  const submitted = (checklists ?? []).map(joinChecklist).filter((c) => c.status === "submitted");

  const templateRows = (templates ?? []).map((t) => ({
    ...(t as unknown as ChecklistTemplate),
    companyName: (t.companies as { name?: string } | null)?.name ?? "—",
  }));

  const assignmentRows = (assignments ?? []).map((a) => ({
    id: a.id,
    templateId: a.template_id,
    adminNote: a.admin_note,
    companyName: (a.companies as { name?: string } | null)?.name ?? "—",
    employeeName: (a.employees as { full_name?: string } | null)?.full_name ?? "—",
    site: (a.checklist_templates as { site?: string } | null)?.site ?? "—",
  }));

  return (
    <div>
      <PageHeader title="Checklists" subtitle="Create checklist templates, assign them to employees, and review daily submissions" />
      <ChecklistsTabs
        submitted={submitted}
        templates={templateRows}
        assignments={assignmentRows}
        companies={companies ?? []}
        sites={sites ?? []}
        employees={employeeOptions}
      />
    </div>
  );
}
