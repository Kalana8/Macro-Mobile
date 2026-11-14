import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import type { WeeklyReport } from "@macro/shared/types";
import { WeeklyReportsTable, type WeeklyReportRow } from "./WeeklyReportsTable";

export default async function WeeklyReportsPage() {
  const supabase = await createClient();

  const [{ data: reports, error }, { data: companies }, { data: sites }, { data: employees }, { data: sections }, { data: recipients }] =
    await Promise.all([
      supabase
        .from("weekly_reports")
        .select("*, companies(name), sites(name)")
        .order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("sites").select("id, name, company_id").order("name"),
      supabase.from("employees").select("id, full_name").order("full_name"),
      supabase.from("report_sections").select("id, report_id"),
      // `*`: verified_at only exists once migration 0050 is applied; missing entirely before 0046.
      supabase.from("weekly_report_recipients").select("*"),
    ]);

  const employeeNameById = new Map((employees ?? []).map((e) => [e.id, e.full_name]));
  const sectionCountByReport = new Map<string, number>();
  for (const s of sections ?? []) {
    sectionCountByReport.set(s.report_id, (sectionCountByReport.get(s.report_id) ?? 0) + 1);
  }

  // What the people it was shared with have done in the app.
  const responsesByReport = new Map<string, { shared: number; verified: number; submitted: number }>();
  for (const x of (recipients ?? []) as { report_id: string; verified_at?: string | null; submitted_at?: string | null }[]) {
    const t = responsesByReport.get(x.report_id) ?? { shared: 0, verified: 0, submitted: 0 };
    t.shared += 1;
    if (x.verified_at || x.submitted_at) t.verified += 1;
    if (x.submitted_at) t.submitted += 1;
    responsesByReport.set(x.report_id, t);
  }

  const rows: WeeklyReportRow[] = (reports ?? []).map((r) => ({
    ...(r as unknown as WeeklyReport),
    companyName: (r.companies as { name?: string } | null)?.name ?? "—",
    siteName: (r.sites as { name?: string } | null)?.name ?? null,
    auditorName: r.auditor_id ? (employeeNameById.get(r.auditor_id) ?? "—") : "—",
    supervisorName: r.supervisor_id ? (employeeNameById.get(r.supervisor_id) ?? "—") : "—",
    sectionCount: sectionCountByReport.get(r.id) ?? 0,
    responses: responsesByReport.get(r.id) ?? { shared: 0, verified: 0, submitted: 0 },
  }));

  return (
    <div>
      <PageHeader
        title="Actions Reports"
        subtitle="Site-inspection improvement reports for Auditors and Supervisors"
      />

      {error && (
        <div className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          Couldn&apos;t load reports — connect Supabase to see live data.
        </div>
      )}

      {!error && (
        <WeeklyReportsTable
          reports={rows}
          companies={companies ?? []}
          sites={sites ?? []}
          employees={employees ?? []}
        />
      )}
    </div>
  );
}
