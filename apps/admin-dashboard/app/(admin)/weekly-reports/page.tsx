import { createClient } from "@macro/shared/supabase/server";
import { PageHeader } from "@/components/ui";
import type { WeeklyReport } from "@macro/shared/types";
import { WeeklyReportsTable, type WeeklyReportRow } from "./WeeklyReportsTable";

export default async function WeeklyReportsPage() {
  const supabase = await createClient();

  const [{ data: reports, error }, { data: companies }, { data: sites }, { data: employees }, { data: sections }] =
    await Promise.all([
      supabase
        .from("weekly_reports")
        .select("*, companies(name), sites(name)")
        .order("created_at", { ascending: false }),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("sites").select("id, name, company_id").order("name"),
      supabase.from("employees").select("id, full_name").order("full_name"),
      supabase.from("report_sections").select("id, report_id"),
    ]);

  const employeeNameById = new Map((employees ?? []).map((e) => [e.id, e.full_name]));
  const sectionCountByReport = new Map<string, number>();
  for (const s of sections ?? []) {
    sectionCountByReport.set(s.report_id, (sectionCountByReport.get(s.report_id) ?? 0) + 1);
  }

  const rows: WeeklyReportRow[] = (reports ?? []).map((r) => ({
    ...(r as unknown as WeeklyReport),
    companyName: (r.companies as { name?: string } | null)?.name ?? "—",
    siteName: (r.sites as { name?: string } | null)?.name ?? null,
    auditorName: r.auditor_id ? (employeeNameById.get(r.auditor_id) ?? "—") : "—",
    supervisorName: r.supervisor_id ? (employeeNameById.get(r.supervisor_id) ?? "—") : "—",
    sectionCount: sectionCountByReport.get(r.id) ?? 0,
  }));

  return (
    <div>
      <PageHeader
        title="Weekly Action Report"
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
