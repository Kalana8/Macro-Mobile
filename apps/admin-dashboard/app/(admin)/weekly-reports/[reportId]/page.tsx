import { notFound } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";
import type { PhotoAnnotation, ReportPhoto, WeeklyReport } from "@macro/shared/types";
import { ReportEditor } from "./ReportEditor";
import type { SectionWithPhotos, WireAnnotationsByPhotoId } from "../types";

export default async function ReportEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ action?: string }>;
}) {
  const { reportId } = await params;
  const { action } = await searchParams;
  const supabase = await createClient();

  const { data: reportRow } = await supabase
    .from("weekly_reports")
    .select("*, companies(name), sites(name)")
    .eq("id", reportId)
    .maybeSingle();

  if (!reportRow) notFound();

  const [{ data: sectionsRaw }, { data: companies }, { data: sites }, { data: employees }, { data: pdfs }, { data: shares }, { data: people }, { data: memberships }, recipientsResult] =
    await Promise.all([
      supabase.from("report_sections").select("*").eq("report_id", reportId).order("sort_order"),
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("sites").select("id, name, company_id").order("name"),
      supabase.from("employees").select("id, full_name").order("full_name"),
      supabase.from("report_pdfs").select("*").eq("report_id", reportId).order("generated_at", { ascending: false }),
      supabase.from("report_shares").select("*").eq("report_id", reportId).order("sent_at", { ascending: false }),
      supabase.from("employees").select("id, full_name, job_role, status").order("full_name"),
      supabase.from("employee_companies").select("employee_id, company_id"),
      // Missing until migration 0046 is applied; the share window then says so.
      // `*`: verified_at only exists once migration 0050 is applied.
      supabase.from("weekly_report_recipients").select("*").eq("report_id", reportId),
    ]);

  const companyIdsByEmployee: Record<string, string[]> = {};
  for (const m of memberships ?? []) (companyIdsByEmployee[m.employee_id] ??= []).push(m.company_id);
  const shareTargets = (people ?? [])
    .filter((p) => (p as { status?: string }).status !== "inactive")
    .map((p) => ({ id: p.id, full_name: p.full_name, job_role: p.job_role ?? null, companyIds: companyIdsByEmployee[p.id] ?? [] }));

  const sectionIds = (sectionsRaw ?? []).map((s) => s.id);
  const { data: photos } = sectionIds.length
    ? await supabase.from("report_photos").select("*").in("section_id", sectionIds).order("sort_order")
    : { data: [] as ReportPhoto[] };

  const photoIds = (photos ?? []).map((p) => p.id);
  const { data: annotationRows } = photoIds.length
    ? await supabase.from("report_photo_annotations").select("*").in("photo_id", photoIds)
    : { data: [] as PhotoAnnotation[] };

  const photosBySection = new Map<string, ReportPhoto[]>();
  for (const p of photos ?? []) {
    const list = photosBySection.get(p.section_id) ?? [];
    list.push(p as ReportPhoto);
    photosBySection.set(p.section_id, list);
  }

  const sections: SectionWithPhotos[] = (sectionsRaw ?? []).map((s) => ({
    ...s,
    photos: photosBySection.get(s.id) ?? [],
  }));

  const annotations: WireAnnotationsByPhotoId = {};
  for (const a of annotationRows ?? []) {
    const row = a as PhotoAnnotation;
    annotations[a.photo_id] = { ...row, shapes_json: JSON.stringify(row.shapes_json) };
  }

  const employeeNameById = new Map((employees ?? []).map((e) => [e.id, e.full_name]));
  const report = reportRow as unknown as WeeklyReport;

  // Photos people sent back from the app are private storage paths; sign them for display.
  const responsePaths = [...new Set((recipientsResult.data ?? []).flatMap((r) => (r.response_images as string[] | null) ?? []))];
  const responsePhotoUrls: Record<string, string> = {};
  if (responsePaths.length) {
    const { data: signed } = await supabase.storage.from("audit-images").createSignedUrls(responsePaths, 60 * 60);
    for (const x of signed ?? []) if (x.path && x.signedUrl) responsePhotoUrls[x.path] = x.signedUrl;
  }

  return (
    <ReportEditor
      report={{
        ...report,
        companyName: (reportRow.companies as { name?: string } | null)?.name ?? "—",
        siteName: (reportRow.sites as { name?: string } | null)?.name ?? null,
        auditorName: report.auditor_id ? (employeeNameById.get(report.auditor_id) ?? "—") : "—",
        supervisorName: report.supervisor_id ? (employeeNameById.get(report.supervisor_id) ?? "—") : "—",
      }}
      sections={sections}
      annotations={annotations}
      companies={companies ?? []}
      sites={sites ?? []}
      employees={employees ?? []}
      pdfs={pdfs ?? []}
      shares={shares ?? []}
      employeeNameById={employeeNameById}
      initialAction={action}
      shareTargets={shareTargets}
      recipients={
        recipientsResult.error
          ? null
          : (recipientsResult.data ?? []).map((r) => ({
              employee_id: r.employee_id,
              shared_at: r.shared_at,
              seen_at: r.seen_at,
              access: r.access === "edit" ? ("edit" as const) : ("view" as const),
              submitted_at: r.submitted_at ?? null,
              verified_at: r.verified_at ?? null,
              response_note: r.response_note ?? "",
              response_images: r.response_images ?? [],
            }))
      }
      responsePhotoUrls={responsePhotoUrls}
    />
  );
}
