import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import { toOne } from "@/lib/embed";
import type { InductionCertificate, InductionSubmission, InductionToken } from "@macro/shared/types";
import { InductionTabs } from "./InductionTabs";
import { InductionsTable } from "./InductionsTable";
import type { InductionRow } from "./types";

export default async function InductionsPage({
  searchParams,
}: {
  searchParams: Promise<{ newFromTemplate?: string }>;
}) {
  const { newFromTemplate } = await searchParams;
  const supabase = await createClient();

  const [
    { data: tokens, error },
    { data: companies },
    { data: sites },
    { data: memberRows },
    { data: submissions },
    { data: certificates },
    { data: templates },
    { data: siteInductions },
    { data: siteLinks, error: siteLinksError },
  ] = await Promise.all([
      supabase
        .from("induction_tokens")
        .select("*, employees!induction_tokens_employee_id_fkey(full_name), sites(name, companies(name))")
        .order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("sites").select("id, name, company_id").order("name"),
      supabase.from("employee_companies").select("employee_id, company_id, employees(full_name, status)"),
      supabase.from("induction_submissions").select("*").order("created_at", { ascending: false }),
      supabase.from("induction_certificates").select("*"),
      supabase.from("induction_templates").select("id, name").eq("status", "published").order("name"),
      // Missing until migration 0056 is run; then the list is just empty.
      supabase.from("site_inductions").select("id, site_id, template_id, induction_templates(name)").eq("active", true).order("created_at"),
      // Who works at which site (migration 0062); missing before it.
      supabase.from("employee_sites").select("employee_id, site_id"),
    ]);

  const members = (memberRows ?? []).flatMap((m) => {
    const e = toOne(m.employees as { full_name?: string; status?: string } | { full_name?: string; status?: string }[] | null);
    if (!e?.full_name || (e.status && e.status !== "active")) return [];
    const siteIds = siteLinksError ? null : (siteLinks ?? []).filter((l) => l.employee_id === m.employee_id).map((l) => l.site_id as string);
    return [{ employee_id: m.employee_id as string, company_id: m.company_id as string, full_name: e.full_name, siteIds }];
  });
  const siteById = new Map((sites ?? []).map((s) => [s.id, s]));
  const companyName = new Map((companies ?? []).map((c) => [c.id, c.name as string]));
  const automatic = (siteInductions ?? []).map((si) => {
    const site = siteById.get(si.site_id as string);
    const tpl = toOne(si.induction_templates as { name?: string } | { name?: string }[] | null);
    return {
      id: si.id as string,
      siteName: site?.name ?? "—",
      companyName: (site && companyName.get(site.company_id)) ?? "—",
      templateName: tpl?.name ?? "Site Induction",
    };
  });

  const submissionByToken = new Map<string, InductionSubmission>();
  for (const s of (submissions ?? []) as InductionSubmission[]) {
    if (!submissionByToken.has(s.token_id)) submissionByToken.set(s.token_id, s); // most recent first, per the order() above
  }
  const certificateBySubmission = new Map<string, InductionCertificate>();
  for (const c of (certificates ?? []) as InductionCertificate[]) {
    certificateBySubmission.set(c.submission_id, c);
  }

  const rows: InductionRow[] = (tokens ?? []).map((t) => {
    const employee = toOne(t.employees as { full_name?: string } | { full_name?: string }[] | null);
    const site = toOne(t.sites as { name?: string; companies?: unknown } | { name?: string; companies?: unknown }[] | null);
    const company = toOne(site?.companies as { name?: string } | { name?: string }[] | null | undefined);
    const submission = submissionByToken.get(t.id) ?? null;
    return {
      ...(t as unknown as InductionToken),
      employeeName: employee?.full_name ?? "—",
      siteName: site?.name ?? "—",
      companyName: company?.name ?? "—",
      submission,
      certificate: submission ? (certificateBySubmission.get(submission.id) ?? null) : null,
    };
  });

  return (
    <div>
      <PageHeader title="Induction and Check Links" subtitle="Site induction invitations, expiration, and approval" />
      <InductionTabs active="invitations" />

      {error && (
        <div className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          Couldn&apos;t load inductions — connect Supabase to see live data.
        </div>
      )}

      {!error && (
        <InductionsTable
          rows={rows}
          companies={companies ?? []}
          sites={sites ?? []}
          members={members}
          automatic={automatic}
          templates={templates ?? []}
          initialTemplateId={newFromTemplate}
        />
      )}
    </div>
  );
}
