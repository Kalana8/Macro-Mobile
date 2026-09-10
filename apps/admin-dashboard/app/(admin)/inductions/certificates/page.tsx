import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import { toOne } from "@/lib/embed";
import type { InductionAttempt } from "@macro/shared/types";
import { InductionTabs } from "../InductionTabs";
import { CertificatesTable, type CertificateRow } from "./CertificatesTable";

export default async function CertificatesPage() {
  const supabase = await createClient();

  const { data: certificates, error } = await supabase
    .from("induction_certificates")
    .select(
      "*, employees!induction_certificates_employee_id_fkey(full_name), sites!induction_certificates_site_id_fkey(name, companies(name)), induction_submissions!induction_certificates_submission_id_fkey(id, token_id, attempts)"
    )
    .order("issued_at", { ascending: false });

  if (error || !certificates) {
    return (
      <div>
        <PageHeader title="Certificates" subtitle="Every certificate issued, with verification and revocation controls" />
        <InductionTabs active="certificates" />
        <div className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">Couldn&apos;t load certificates — connect Supabase to see live data.</div>
      </div>
    );
  }

  const submissionEntries = certificates.map((c) =>
    toOne(c.induction_submissions as { id?: string; token_id?: string; attempts?: InductionAttempt[] } | { id?: string; token_id?: string; attempts?: InductionAttempt[] }[] | null)
  );
  const tokenIds = Array.from(new Set(submissionEntries.map((s) => s?.token_id).filter((v): v is string => Boolean(v))));

  const { data: tokens } =
    tokenIds.length > 0
      ? await supabase.from("induction_tokens").select("id, template_id").in("id", tokenIds)
      : { data: [] as { id: string; template_id: string | null }[] };
  const templateIdByToken = new Map((tokens ?? []).map((t) => [t.id, t.template_id]));

  const templateIds = Array.from(new Set(Array.from(templateIdByToken.values()).filter((v): v is string => Boolean(v))));
  const { data: templates } =
    templateIds.length > 0 ? await supabase.from("induction_templates").select("id, name").in("id", templateIds) : { data: [] as { id: string; name: string }[] };
  const templateNameById = new Map((templates ?? []).map((t) => [t.id, t.name]));

  const rows: CertificateRow[] = certificates.map((c, i) => {
    const employee = toOne(c.employees as { full_name?: string } | { full_name?: string }[] | null);
    const site = toOne(c.sites as { name?: string; companies?: unknown } | { name?: string; companies?: unknown }[] | null);
    const company = toOne(site?.companies as { name?: string } | { name?: string }[] | null | undefined);
    const submission = submissionEntries[i];
    const templateId = submission?.token_id ? templateIdByToken.get(submission.token_id) : null;
    const passedAttempt = [...(submission?.attempts ?? [])].reverse().find((a) => a.passed) ?? null;

    return {
      id: c.id,
      tokenId: submission?.token_id ?? "",
      certificateNumber: c.certificate_number,
      employeeName: employee?.full_name ?? "—",
      companyName: company?.name ?? "—",
      siteName: site?.name ?? "—",
      assignmentName: templateId ? (templateNameById.get(templateId) ?? "Site Induction") : "Site Induction",
      scorePercent: passedAttempt?.percentage ?? null,
      status: c.status,
      issuedAt: c.issued_at,
      expiresAt: c.expires_at,
      fileUrl: c.file_url,
    };
  });

  return (
    <div>
      <PageHeader title="Certificates" subtitle="Every certificate issued, with verification and revocation controls" />
      <InductionTabs active="certificates" />
      <CertificatesTable rows={rows} />
    </div>
  );
}
