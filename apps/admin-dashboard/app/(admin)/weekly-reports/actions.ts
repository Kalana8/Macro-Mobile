"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";
import { uploadImageToImageKit } from "@macro/shared/imagekit";
import { getCurrentAdmin } from "@/lib/session";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

async function requireEmployeeId(): Promise<string> {
  const admin = await getCurrentAdmin();
  if (!admin?.employee) throw new Error("Not signed in.");
  return admin.employee.id;
}

// ---------------------------------------------------------------------------
// Report header
// ---------------------------------------------------------------------------

/** Creates a new report and redirects straight into its editor — mirrors "Create New Report". */
export async function createReportAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const companyId = String(formData.get("companyId") ?? "");
  const weekStart = String(formData.get("weekStart") ?? "");
  const weekEnding = String(formData.get("weekEnding") ?? "");
  if (!companyId || !weekStart || !weekEnding) {
    return { error: "Company, week starting and week ending are required." };
  }

  const employeeId = await requireEmployeeId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_reports")
    .insert({
      title: String(formData.get("title") ?? ""),
      week_start: weekStart,
      week_ending: weekEnding,
      company_id: companyId,
      site_id: String(formData.get("siteId") ?? "") || null,
      location: String(formData.get("location") ?? ""),
      auditor_id: String(formData.get("auditorId") ?? "") || null,
      supervisor_id: String(formData.get("supervisorId") ?? "") || null,
      report_date: String(formData.get("reportDate") ?? ""),
      created_by: employeeId,
      status: "in_progress",
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Couldn't create the report." };

  // Start the editor with one section already in place — ready for a note
  // and a photo — instead of making the user click "+ Add Section" first.
  await supabase.from("report_sections").insert({ report_id: data.id, sort_order: 0, title: "Section 1" });

  revalidatePath("/weekly-reports");
  redirect(`/weekly-reports/${data.id}`);
}

export interface ReportHeaderPatch {
  title?: string;
  week_start?: string;
  week_ending?: string;
  company_id?: string;
  site_id?: string | null;
  location?: string;
  auditor_id?: string | null;
  supervisor_id?: string | null;
  report_date?: string;
}

/** Inline "Save Draft" for the header fields — called directly from ReportEditor, not a <form>. */
export async function updateReportHeaderAction(reportId: string, patch: ReportHeaderPatch): Promise<ActionResult> {
  const employeeId = await requireEmployeeId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("weekly_reports")
    .update({ ...patch, updated_by: employeeId, updated_at: new Date().toISOString() })
    .eq("id", reportId);

  if (error) return { error: error.message };
  revalidatePath(`/weekly-reports/${reportId}`);
  revalidatePath("/weekly-reports");
  return { success: true };
}

export async function markReportCompletedAction(reportId: string): Promise<ActionResult> {
  const employeeId = await requireEmployeeId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("weekly_reports")
    .update({ status: "completed", updated_by: employeeId, updated_at: new Date().toISOString() })
    .eq("id", reportId);

  if (error) return { error: error.message };
  revalidatePath(`/weekly-reports/${reportId}`);
  revalidatePath("/weekly-reports");
  return { success: true };
}

export async function deleteReportAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("weekly_reports").delete().eq("id", id);
  revalidatePath("/weekly-reports");
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/** Adds a blank section, bumping a still-draft report to "in_progress". Returns the new row for local state. */
export async function addSectionAction(reportId: string, nextSortOrder: number) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_sections")
    .insert({ report_id: reportId, sort_order: nextSortOrder, title: `Section ${nextSortOrder + 1}` })
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Couldn't add the section." } as const;

  await supabase.from("weekly_reports").update({ status: "in_progress" }).eq("id", reportId).eq("status", "draft");

  revalidatePath(`/weekly-reports/${reportId}`);
  return { section: data } as const;
}

export interface SectionPatch {
  title?: string;
  area_location?: string;
  notes?: string;
}

export async function updateSectionAction(sectionId: string, reportId: string, patch: SectionPatch): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("report_sections")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", sectionId);

  if (error) return { error: error.message };
  revalidatePath(`/weekly-reports/${reportId}`);
  return { success: true };
}

export async function deleteSectionAction(sectionId: string, reportId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("report_sections").delete().eq("id", sectionId);
  if (error) return { error: error.message };
  revalidatePath(`/weekly-reports/${reportId}`);
  return { success: true };
}

export async function reorderSectionsAction(reportId: string, orderedIds: string[]): Promise<ActionResult> {
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("report_sections").update({ sort_order: index }).eq("id", id))
  );
  revalidatePath(`/weekly-reports/${reportId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export async function uploadReportPhotoAction(formData: FormData) {
  const file = formData.get("file");
  const sectionId = String(formData.get("sectionId") ?? "");
  const reportId = String(formData.get("reportId") ?? "");
  if (!(file instanceof File) || !sectionId) return { error: "No file provided." } as const;

  const employeeId = await requireEmployeeId();
  try {
    const url = await uploadImageToImageKit(file, `weekly-reports/${reportId}/${sectionId}`);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("report_photos")
      .insert({ section_id: sectionId, original_url: url, uploaded_by: employeeId })
      .select("*")
      .single();
    if (error || !data) return { error: error?.message ?? "Couldn't save the photo." } as const;
    revalidatePath(`/weekly-reports/${reportId}`);
    return { photo: data } as const;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed." } as const;
  }
}

export async function deletePhotoAction(photoId: string, reportId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("report_photos").delete().eq("id", photoId);
  if (error) return { error: error.message };
  revalidatePath(`/weekly-reports/${reportId}`);
  return { success: true };
}

export async function reorderPhotosAction(orderedIds: string[], reportId: string): Promise<ActionResult> {
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("report_photos").update({ sort_order: index }).eq("id", id))
  );
  revalidatePath(`/weekly-reports/${reportId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Annotations — original photo (report_photos.original_url) is never
// touched; this only ever writes to report_photo_annotations.
// ---------------------------------------------------------------------------

/**
 * Takes a FormData (not scalar args) specifically so the rasterized
 * annotation PNG travels as a real file, the same way every other upload in
 * this app works (see uploadReportPhotoAction) — a large base64 image string
 * passed as a plain Server Action argument gets chunked internally by
 * Next's Flight protocol into enough array slots to trip its safety limit
 * ("Maximum array nesting exceeded"). Fields: photoId, reportId,
 * shapesJson (a JSON string of the Fabric canvas), and an optional
 * "file" (the rasterized PNG — absent when the canvas is CORS-tainted).
 */
export async function saveAnnotationAction(formData: FormData) {
  const photoId = String(formData.get("photoId") ?? "");
  const reportId = String(formData.get("reportId") ?? "");
  const file = formData.get("file");

  const employeeId = await requireEmployeeId();
  const supabase = await createClient();

  let shapesJson: Record<string, unknown>;
  try {
    shapesJson = JSON.parse(String(formData.get("shapesJson") ?? "{}"));
  } catch {
    return { error: "Invalid annotation data." } as const;
  }

  let annotatedUrl: string | null = null;
  if (file instanceof File) {
    try {
      annotatedUrl = await uploadImageToImageKit(file, "weekly-reports/annotations");
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Couldn't save the annotated image." } as const;
    }
  }

  const { data, error } = await supabase
    .from("report_photo_annotations")
    .upsert(
      { photo_id: photoId, shapes_json: shapesJson, annotated_image_url: annotatedUrl, updated_by: employeeId, updated_at: new Date().toISOString() },
      { onConflict: "photo_id" }
    )
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Couldn't save the annotation." } as const;
  revalidatePath(`/weekly-reports/${reportId}`);
  return { annotation: { ...data, shapes_json: JSON.stringify(data.shapes_json) } } as const;
}

/** "Clear all annotations" back to the untouched original. */
export async function clearAnnotationAction(photoId: string, reportId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("report_photo_annotations").delete().eq("photo_id", photoId);
  if (error) return { error: error.message };
  revalidatePath(`/weekly-reports/${reportId}`);
  return { success: true };
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------

/**
 * Stores a client-rendered PDF (see PdfGenerator.ts) and versions it against
 * the report. Takes a FormData with the PDF as a real "file" field, not a
 * base64 data URL argument — a multi-page report's PDF is easily several
 * MB as base64 text, which Next's Flight protocol chunks into enough array
 * slots to trip its safety limit ("Maximum array nesting exceeded").
 */
export async function generatePdfAction(formData: FormData) {
  const reportId = String(formData.get("reportId") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No PDF provided." } as const;

  const employeeId = await requireEmployeeId();
  const supabase = await createClient();

  const { data: report } = await supabase.from("weekly_reports").select("report_number").eq("id", reportId).single();
  const { count } = await supabase
    .from("report_pdfs")
    .select("*", { count: "exact", head: true })
    .eq("report_id", reportId);
  const version = (count ?? 0) + 1;

  let fileUrl: string;
  try {
    const named = new File([file], `${report?.report_number ?? reportId}-v${version}.pdf`, { type: "application/pdf" });
    fileUrl = await uploadImageToImageKit(named, `weekly-reports/${reportId}/pdfs`);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Couldn't upload the PDF." } as const;
  }

  const { data, error } = await supabase
    .from("report_pdfs")
    .insert({ report_id: reportId, version, file_url: fileUrl, generated_by: employeeId })
    .select("*")
    .single();

  if (error || !data) return { error: error?.message ?? "Couldn't record the generated PDF." } as const;

  await supabase.from("weekly_reports").update({ status: "pdf_generated" }).eq("id", reportId);
  revalidatePath(`/weekly-reports/${reportId}`);
  revalidatePath("/weekly-reports");
  return { pdf: data } as const;
}

// ---------------------------------------------------------------------------
// Sharing — opens the user's own WhatsApp/email client (wa.me / mailto:),
// the same pattern already used for Checklists, rather than a Business
// WhatsApp API/email-provider integration. This just records what was
// shared for the report's history — the actual send happens client-side.
// ---------------------------------------------------------------------------

export async function logReportShareAction(params: {
  reportId: string;
  pdfId: string | null;
  channel: "whatsapp" | "email";
  recipient: string;
  cc?: string;
  subject?: string;
  message?: string;
}): Promise<ActionResult> {
  const employeeId = await requireEmployeeId();
  const supabase = await createClient();
  const { error } = await supabase.from("report_shares").insert({
    report_id: params.reportId,
    pdf_id: params.pdfId,
    channel: params.channel,
    recipient: params.recipient,
    cc: params.cc || null,
    subject: params.subject || null,
    message: params.message || null,
    status: "sent",
    sent_by: employeeId,
  });
  if (error) return { error: error.message };

  await supabase.from("weekly_reports").update({ status: "sent" }).eq("id", params.reportId);
  revalidatePath(`/weekly-reports/${params.reportId}`);
  revalidatePath("/weekly-reports");
  return { success: true };
}
