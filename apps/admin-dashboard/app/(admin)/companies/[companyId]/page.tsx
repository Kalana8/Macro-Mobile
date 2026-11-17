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

  const [{ data: memberships }, { data: allEmployees }, { data: templates }, { data: sites }, { data: siteLinks, error: siteLinksError }] = await Promise.all([
    supabase.from("employee_companies").select("employee_id").eq("company_id", companyId),
    supabase.from("employees").select("id, full_name, job_role, status"),
    supabase.from("checklist_templates").select("*, sites(name)").eq("company_id", companyId),
    supabase.from("sites").select("*").eq("company_id", companyId).order("name"),
    // Missing until migration 0062.
    supabase.from("employee_sites").select("employee_id, site_id"),
  ]);

  const memberIds = new Set((memberships ?? []).map((m) => m.employee_id));
  const siteName = new Map((sites ?? []).map((s) => [s.id as string, s.name as string]));
  // Which of this company's sites each employee works at; none picked means all of them.
  const employees = (allEmployees ?? [])
    .filter((e) => memberIds.has(e.id))
    .map((e) => {
      const at = (siteLinks ?? []).filter((l) => l.employee_id === e.id && siteName.has(l.site_id as string)).map((l) => siteName.get(l.site_id as string)!);
      // Before migration 0062 everyone is at every site.
      return { ...e, sites: siteLinksError ? (sites ?? []).map((s) => s.name).join(", ") || "—" : at.join(", ") || "No site yet" };
    });
  const candidates = (allEmployees ?? []).filter((e) => !memberIds.has(e.id));
  const employeeOptions = employees.map((e) => ({ id: e.id, full_name: e.full_name, companyIds: [companyId] }));

  const templateRows = (templates ?? []).map((t) => ({
    ...(t as unknown as ChecklistTemplate),
    site: (t.sites as { name?: string } | null)?.name ?? "—",
  }));

  return (
    <div>
      <PageHeader title={company.name} subtitle={company.location ?? undefined} />

      <div className="mb-6">
        <CompanyEmployees companyId={company.id} companyName={company.name} employees={employees} candidates={candidates} sites={(sites ?? []).map((s) => ({ id: s.id as string, name: s.name as string }))} />
      </div>

      <div className="mb-6">
        <CompanySites companyId={company.id} sites={(sites ?? []) as Site[]} />
      </div>

      <CompanyChecklists
        companyId={company.id}
        companyName={company.name}
        templates={templateRows}
        sites={(sites ?? []) as Site[]}
        employees={employeeOptions}
      />
    </div>
  );
}
