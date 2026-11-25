import { createClient } from "@macro/shared/supabase/server";
import { todayInBusinessTimezone } from "@macro/shared/datetime";
import { PageHeader } from "@/components/ui";
import type { Checklist, ChecklistTemplate, Site } from "@macro/shared/types";
import { ChecklistsTabs } from "./ChecklistsTabs";

export default async function ChecklistsPage() {
  const supabase = await createClient();
  // Still-to-do checklists from the last 2 months, for the Expired tab.
  const since = new Date(Date.parse(`${todayInBusinessTimezone()}T00:00:00Z`) - 62 * 86400000).toISOString().slice(0, 10);

  const [
    { data: checklists },
    { data: templates },
    { data: assignments },
    { data: companies },
    { data: sites },
    { data: employees },
    { data: memberships },
    { data: pendingRows },
  ] = await Promise.all([
    supabase
      .from("checklists")
      .select("*, companies(name), employees(full_name)")
      .order("assigned_date", { ascending: false })
      .limit(80),
    supabase.from("checklist_templates").select("*, companies(name), sites(name)").order("created_at", { ascending: false }),
    supabase
      .from("checklist_assignments")
      .select("*, companies(name), employees(full_name), checklist_templates(sites(name))")
      .order("created_at", { ascending: false }),
    supabase.from("companies").select("id, name").order("name"),
    supabase.from("sites").select("*").order("name"),
    supabase.from("employees").select("id, full_name").order("full_name"),
    supabase.from("employee_companies").select("employee_id, company_id"),
    supabase
      .from("checklists")
      .select("*, companies(name), employees(full_name)")
      .eq("status", "pending")
      .gte("assigned_date", since)
      .order("assigned_date", { ascending: false })
      .limit(300),
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

  const nameOf = new Map((employees ?? []).map((e) => [e.id, e.full_name as string]));
  const joinChecklist = (c: NonNullable<typeof checklists>[number]) => {
    const owner = (c.employees as { full_name?: string } | null)?.full_name ?? "—";
    // Paired (0072): submitted by the other person for this one.
    const by = c.submitted_by && c.submitted_by !== c.employee_id ? nameOf.get(c.submitted_by as string) : null;
    return {
      ...(c as unknown as Checklist),
      companyName: (c.companies as { name?: string } | null)?.name ?? "—",
      employeeName: by ? `${owner} · submitted by ${by} (pair)` : owner,
    };
  };

  const submitted = (checklists ?? []).map(joinChecklist).filter((c) => c.status === "submitted");
  const pending = (pendingRows ?? []).map(joinChecklist);

  const templateRows = (templates ?? []).map((t) => ({
    ...(t as unknown as ChecklistTemplate),
    companyName: (t.companies as { name?: string } | null)?.name ?? "—",
    site: (t.sites as { name?: string } | null)?.name ?? "—",
  }));

  const assignmentRows = (assignments ?? []).map((a) => ({
    id: a.id,
    templateId: a.template_id,
    employeeId: a.employee_id as string,
    pairId: (a.pair_id as string | null) ?? null,
    adminNote: a.admin_note,
    companyName: (a.companies as { name?: string } | null)?.name ?? "—",
    employeeName: (a.employees as { full_name?: string } | null)?.full_name ?? "—",
    site:
      (
        a.checklist_templates as { sites?: { name?: string } | null } | null
      )?.sites?.name ?? "—",
  }));

  return (
    <div>
      <PageHeader title="Checklists" subtitle="Create checklist templates, assign them to employees, and review daily submissions" />
      <ChecklistsTabs
        submitted={submitted}
        pending={pending}
        templates={templateRows}
        assignments={assignmentRows}
        companies={companies ?? []}
        sites={(sites ?? []) as Site[]}
        employees={employeeOptions}
      />
    </div>
  );
}
