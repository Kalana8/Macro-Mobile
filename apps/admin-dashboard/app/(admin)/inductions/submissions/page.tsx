import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import { toOne } from "@/lib/embed";
import type { InductionCertificate } from "@macro/shared/types";
import { InductionTabs } from "../InductionTabs";
import { SubmissionsTable } from "./SubmissionsTable";
import type { SubmissionRow } from "./types";

export default async function SubmittedFormsPage() {
  const supabase = await createClient();

  const { data: submissions, error } = await supabase
    .from("induction_submissions")
    .select(
      "*, induction_tokens!induction_submissions_token_id_fkey(id, template_id), employees!induction_submissions_employee_id_fkey(full_name), sites!induction_submissions_site_id_fkey(name, companies(name))"
    )
    .neq("status", "draft")
    .order("submitted_at", { ascending: false });

  if (error || !submissions) {
    return (
      <div>
        <PageHeader title="Submitted Forms" subtitle="Every completed induction submission, with certificates and admin review" />
        <InductionTabs active="submissions" />
        <div className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">Couldn&apos;t load submitted forms — connect Supabase to see live data.</div>
      </div>
    );
  }

  const templateIds = Array.from(
    new Set(
      submissions
        .map((s) => toOne(s.induction_tokens as { template_id?: string | null } | { template_id?: string | null }[] | null)?.template_id)
        .filter((v): v is string => Boolean(v))
    )
  );
  const submissionIds = submissions.map((s) => s.id);

  const [{ data: templates }, { data: certificates }] = await Promise.all([
    templateIds.length > 0
      ? supabase.from("induction_templates").select("id, name").in("id", templateIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    submissionIds.length > 0
      ? supabase.from("induction_certificates").select("*").in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as InductionCertificate[] }),
  ]);

  const templateNameById = new Map((templates ?? []).map((t) => [t.id, t.name]));
  const certificateBySubmission = new Map((certificates ?? []).map((c) => [c.submission_id, c as InductionCertificate]));

  const rows: SubmissionRow[] = submissions.map((s) => {
    const token = toOne(s.induction_tokens as { id?: string; template_id?: string | null } | { id?: string; template_id?: string | null }[] | null);
    const employee = toOne(s.employees as { full_name?: string } | { full_name?: string }[] | null);
    const site = toOne(s.sites as { name?: string; companies?: unknown } | { name?: string; companies?: unknown }[] | null);
    const company = toOne(site?.companies as { name?: string } | { name?: string }[] | null | undefined);
    return {
      id: s.id,
      tokenId: token?.id ?? s.token_id,
      employeeName: employee?.full_name ?? "—",
      companyName: company?.name ?? "—",
      siteName: site?.name ?? "—",
      assignmentName: token?.template_id ? (templateNameById.get(token.template_id) ?? "Site Induction") : "Site Induction",
      submittedAt: s.submitted_at,
      status: s.status,
      certificate: certificateBySubmission.get(s.id) ?? null,
    };
  });

  return (
    <div>
      <PageHeader title="Submitted Forms" subtitle="Every completed induction submission, with certificates and admin review" />
      <InductionTabs active="submissions" />
      <SubmissionsTable rows={rows} />
    </div>
  );
}
