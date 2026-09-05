import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import { toOne } from "@/lib/embed";
import type { InductionCertificate, InductionSubmission, InductionToken } from "@macro/shared/types";
import { InductionsTable } from "./InductionsTable";
import type { InductionRow } from "./types";

export default async function InductionsPage() {
  const supabase = await createClient();

  const [{ data: tokens, error }, { data: employees }, { data: sites }, { data: submissions }, { data: certificates }] =
    await Promise.all([
      supabase
        .from("induction_tokens")
        .select("*, employees!induction_tokens_employee_id_fkey(full_name), sites(name, companies(name))")
        .order("created_at", { ascending: false }),
      supabase.from("employees").select("id, full_name").order("full_name"),
      supabase.from("sites").select("id, name, company_id").order("name"),
      supabase.from("induction_submissions").select("*").order("created_at", { ascending: false }),
      supabase.from("induction_certificates").select("*"),
    ]);

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
      <PageHeader title="Induction Links" subtitle="Site induction invitations, expiration, and approval" />

      {error && (
        <div className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          Couldn&apos;t load inductions — connect Supabase to see live data.
        </div>
      )}

      {!error && (
        <InductionsTable
          rows={rows}
          employees={employees ?? []}
          sites={sites ?? []}
        />
      )}
    </div>
  );
}
