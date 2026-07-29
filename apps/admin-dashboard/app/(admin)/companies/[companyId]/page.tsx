import { notFound } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import type { ChecklistTemplate, Site } from "@macro/shared/types";
import { CompanyEmployees } from "./CompanyEmployees";
import { CompanySites } from "./CompanySites";
import { CompanyChecklists } from "./CompanyChecklists";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const supabase = await createClient();

  const { data: company } = await supabase.from("companies").select("*").eq("id", companyId).maybeSingle();
  if (!company) notFound();

  const [{ data: memberships }, { data: allEmployees }, { data: templates }, { data: sites }] = await Promise.all([
    supabase.from("employee_companies").select("employee_id").eq("company_id", companyId),
    supabase.from("employees").select("id, full_name, job_role, status"),
    supabase.from("checklist_templates").select("*").eq("company_id", companyId),
    supabase.from("sites").select("*").eq("company_id", companyId).order("name"),
  ]);

  const memberIds = new Set((memberships ?? []).map((m) => m.employee_id));
  const employees = (allEmployees ?? []).filter((e) => memberIds.has(e.id));
  const candidates = (allEmployees ?? []).filter((e) => !memberIds.has(e.id));
  const employeeOptions = employees.map((e) => ({ id: e.id, full_name: e.full_name, companyIds: [companyId] }));

  return (
    <div>
      <PageHeader title={company.name} subtitle={company.location ?? undefined} />

      <div className="mb-6">
        <CompanyEmployees companyId={company.id} companyName={company.name} employees={employees} candidates={candidates} />
      </div>

      <div className="mb-6">
        <CompanySites companyId={company.id} sites={(sites ?? []) as Site[]} />
      </div>

      <CompanyChecklists
        companyId={company.id}
        companyName={company.name}
        templates={(templates ?? []) as unknown as ChecklistTemplate[]}
        sites={((sites ?? []) as Site[]).map((s) => ({ id: s.id, name: s.name, company_id: s.company_id }))}
        employees={employeeOptions}
      />
    </div>
  );
}
