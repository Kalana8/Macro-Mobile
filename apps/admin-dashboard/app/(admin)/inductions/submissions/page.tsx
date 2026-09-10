import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import { toOne } from "@/lib/embed";
import type { InductionAttempt, InductionCertificate, InductionTrainingSlide, InductionType } from "@macro/shared/types";
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
    .order("updated_at", { ascending: false });

  if (error || !submissions) {
    return (
      <div>
        <PageHeader title="Submitted Forms" subtitle="Every employee's training and assessment progress, with certificates and admin review" />
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
      ? supabase.from("induction_templates").select("id, name, training_slides, pass_mark_percent, induction_type").in("id", templateIds)
      : Promise.resolve({
          data: [] as { id: string; name: string; training_slides: InductionTrainingSlide[]; pass_mark_percent: number; induction_type: InductionType }[],
        }),
    submissionIds.length > 0
      ? supabase.from("induction_certificates").select("*").in("submission_id", submissionIds)
      : Promise.resolve({ data: [] as InductionCertificate[] }),
  ]);

  const templateById = new Map((templates ?? []).map((t) => [t.id, t]));
  const certificateBySubmission = new Map((certificates ?? []).map((c) => [c.submission_id, c as InductionCertificate]));

  const rows: SubmissionRow[] = submissions.map((s) => {
    const token = toOne(s.induction_tokens as { id?: string; template_id?: string | null } | { id?: string; template_id?: string | null }[] | null);
    const employee = toOne(s.employees as { full_name?: string } | { full_name?: string }[] | null);
    const site = toOne(s.sites as { name?: string; companies?: unknown } | { name?: string; companies?: unknown }[] | null);
    const company = toOne(site?.companies as { name?: string } | { name?: string }[] | null | undefined);
    const template = token?.template_id ? templateById.get(token.template_id) : null;
    const trainingSlides = (template?.training_slides as InductionTrainingSlide[] | undefined) ?? [];
    const trainingProgress = (s.training_progress as Record<string, { viewed: boolean }> | null) ?? {};
    const slidesViewed = trainingSlides.filter((slide) => trainingProgress[slide.id]?.viewed).length;
    const attempts = (s.attempts as InductionAttempt[] | null) ?? [];

    return {
      id: s.id,
      tokenId: token?.id ?? s.token_id,
      employeeName: employee?.full_name ?? "—",
      companyName: company?.name ?? "—",
      siteName: site?.name ?? "—",
      assignmentName: template?.name ?? "Site Induction",
      inductionType: (template?.induction_type as InductionType | undefined) ?? "whs",
      submittedAt: s.submitted_at,
      status: s.status,
      certificate: certificateBySubmission.get(s.id) ?? null,
      trainingStatus: s.training_completed_at ? "completed" : slidesViewed > 0 ? "in_progress" : "not_started",
      slidesViewed,
      slidesTotal: trainingSlides.length,
      bestScore: attempts.length > 0 ? Math.max(...attempts.map((a) => a.percentage)) : null,
      latestScore: attempts.length > 0 ? attempts[attempts.length - 1].percentage : null,
      attemptsCount: attempts.length,
      passMarkPercent: template?.pass_mark_percent ?? 100,
    };
  });

  return (
    <div>
      <PageHeader title="Submitted Forms" subtitle="Every employee's training and assessment progress, with certificates and admin review" />
      <InductionTabs active="submissions" />
      <SubmissionsTable rows={rows} />
    </div>
  );
}
