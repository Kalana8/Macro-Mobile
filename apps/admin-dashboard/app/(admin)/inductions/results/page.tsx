import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import { toOne } from "@/lib/embed";
import type { InductionAttempt } from "@macro/shared/types";
import { InductionTabs } from "../InductionTabs";
import { ResultsTable, type AttemptRow } from "./ResultsTable";

export default async function AssessmentResultsPage() {
  const supabase = await createClient();

  const { data: submissions, error } = await supabase
    .from("induction_submissions")
    .select(
      "id, token_id, attempts, induction_tokens!induction_submissions_token_id_fkey(id, template_id), employees!induction_submissions_employee_id_fkey(full_name), sites!induction_submissions_site_id_fkey(name, companies(name))"
    )
    .order("updated_at", { ascending: false });

  if (error || !submissions) {
    return (
      <div>
        <PageHeader title="Assessment Results" subtitle="Every scored attempt, across every employee and assignment" />
        <InductionTabs active="results" />
        <div className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">Couldn&apos;t load assessment results — connect Supabase to see live data.</div>
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
  const { data: templates } =
    templateIds.length > 0
      ? await supabase.from("induction_templates").select("id, name").in("id", templateIds)
      : { data: [] as { id: string; name: string }[] };
  const templateNameById = new Map((templates ?? []).map((t) => [t.id, t.name]));

  const rows: AttemptRow[] = submissions.flatMap((s) => {
    const token = toOne(s.induction_tokens as { id?: string; template_id?: string | null } | { id?: string; template_id?: string | null }[] | null);
    const employee = toOne(s.employees as { full_name?: string } | { full_name?: string }[] | null);
    const site = toOne(s.sites as { name?: string; companies?: unknown } | { name?: string; companies?: unknown }[] | null);
    const company = toOne(site?.companies as { name?: string } | { name?: string }[] | null | undefined);
    const attempts = (s.attempts as InductionAttempt[] | null) ?? [];
    return attempts.map((a) => ({
      key: `${s.id}-${a.attemptNumber}`,
      tokenId: token?.id ?? s.token_id,
      employeeName: employee?.full_name ?? "—",
      companyName: company?.name ?? "—",
      siteName: site?.name ?? "—",
      assignmentName: token?.template_id ? (templateNameById.get(token.template_id) ?? "Site Induction") : "Site Induction",
      attemptNumber: a.attemptNumber,
      score: a.score,
      maxScore: a.maxScore,
      percentage: a.percentage,
      passed: a.passed,
      submittedAt: a.submittedAt,
    }));
  });

  rows.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  return (
    <div>
      <PageHeader title="Assessment Results" subtitle="Every scored attempt, across every employee and assignment" />
      <InductionTabs active="results" />
      <ResultsTable rows={rows} />
    </div>
  );
}
