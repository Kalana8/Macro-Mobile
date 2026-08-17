"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@macro/shared/supabase/server";
import { uploadImageToImageKit } from "@macro/shared/imagekit";
import { todayInBusinessTimezone } from "@macro/shared/datetime";
import type { ChecklistArea } from "@macro/shared/types";
import { parseVisitSchedule } from "../companies/scheduleForm";

export interface ChecklistFormState {
  error?: string;
  success?: boolean;
}

interface DraftArea {
  mainArea: string;
  note: string;
  subtasks: string[];
  images: string[];
}

/** Uploads one checklist photo to ImageKit and returns its public URL — keeps the private key server-only. */
export async function uploadChecklistImageAction(formData: FormData): Promise<{ url?: string; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided." };

  try {
    const url = await uploadImageToImageKit(file, "checklists");
    return { url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }
}

function buildAreas(draft: DraftArea[]): ChecklistArea[] {
  return draft
    .filter((a) => a.mainArea.trim())
    .map((a) => ({
      main_area: a.mainArea.trim(),
      note: a.note.trim(),
      images: a.images ?? [],
      subtasks: a.subtasks
        .filter((s) => s.trim())
        .map((text) => ({ id: randomUUID(), text: text.trim() })),
    }));
}

export async function createTemplateAction(
  _prev: ChecklistFormState,
  formData: FormData
): Promise<ChecklistFormState> {
  const companyId = String(formData.get("companyId") ?? "");
  const siteId = String(formData.get("siteId") ?? "").trim();
  const dayAreasRaw = String(formData.get("dayAreasJson") ?? "{}");
  const templateId = String(formData.get("templateId") ?? "");
  const specialNote = String(formData.get("specialNote") ?? "").trim() || null;

  if (!companyId || !siteId) return { error: "Company and site are required." };

  let dayDraft: Record<string, DraftArea[]>;
  try {
    dayDraft = JSON.parse(dayAreasRaw);
  } catch {
    return { error: "Invalid template data." };
  }
  const dayAreas: Record<string, ChecklistArea[]> = {};
  for (const [day, dayDraftAreas] of Object.entries(dayDraft)) {
    const built = buildAreas(dayDraftAreas);
    if (built.length > 0) dayAreas[day] = built;
  }
  if (Object.keys(dayAreas).length === 0) {
    return { error: "Select a day and add at least one main area with a name." };
  }

  const schedule = parseVisitSchedule(formData);

  const supabase = await createClient();
  const { error } = templateId
    ? await supabase
        .from("checklist_templates")
        .update({ company_id: companyId, site_id: siteId, areas: [], day_areas: dayAreas, special_note: specialNote, ...schedule })
        .eq("id", templateId)
    : await supabase
        .from("checklist_templates")
        .insert({ company_id: companyId, site_id: siteId, areas: [], day_areas: dayAreas, special_note: specialNote, ...schedule });

  if (error) return { error: error.message };

  revalidatePath("/checklists");
  revalidatePath("/companies");
  return { success: true };
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("checklist_templates").delete().eq("id", id);
  revalidatePath("/checklists");
}

/** Stops a checklist immediately — strips today-and-future dates from visit_dates, so generate_due_checklists() has nothing left to fire on. Past dates (and the checklists already generated from them) are left untouched. */
export async function endTemplateAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: template } = await supabase.from("checklist_templates").select("visit_dates").eq("id", id).maybeSingle();
  if (!template) return;

  const today = todayInBusinessTimezone();
  const pastDates = ((template.visit_dates as string[] | null) ?? []).filter((d) => d < today);

  await supabase.from("checklist_templates").update({ visit_dates: pastDates }).eq("id", id);
  revalidatePath("/checklists");
  revalidatePath("/companies");
}

/**
 * Standing assignment — links an employee to a template. From then on, the
 * `checklists` instance for each of the template's listed visit_dates is
 * auto-created by the scheduled generate_due_checklists() function right
 * after midnight on that date. But an admin assigning someone expects it to
 * show up for the employee right away, not wait for that schedule — so this
 * also sends today's instance immediately if today is one of the picked
 * dates.
 */
export async function createAssignmentAction(
  _prev: ChecklistFormState,
  formData: FormData
): Promise<ChecklistFormState> {
  const templateId = String(formData.get("templateId") ?? "");
  const companyId = String(formData.get("companyId") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;
  const employeeIds = formData.getAll("employeeIds").map(String);

  if (!templateId || !companyId || employeeIds.length === 0) {
    return { error: "Company, template and at least one employee are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("checklist_assignments").upsert(
    employeeIds.map((employee_id) => ({
      template_id: templateId,
      company_id: companyId,
      employee_id,
      admin_note: adminNote,
    })),
    { onConflict: "template_id,employee_id" }
  );

  if (error) return { error: error.message };

  const { data: template } = await supabase
    .from("checklist_templates")
    .select("site_id, areas, day_areas, visit_dates, special_note, sites(name)")
    .eq("id", templateId)
    .maybeSingle();

  if (template) {
    const today = todayInBusinessTimezone();
    const isScheduledToday = ((template.visit_dates as string[] | null) ?? []).includes(today);
    const dayAreas = (template.day_areas as Record<string, ChecklistArea[]> | null) ?? {};
    const todayDow = new Date(`${today}T00:00:00`).getDay();
    const areasForToday = dayAreas[String(todayDow)] ?? template.areas;

    const { data: existing } = await supabase
      .from("checklists")
      .select("employee_id")
      .eq("template_id", templateId)
      .eq("assigned_date", today)
      .in("employee_id", employeeIds);

    const alreadySent = new Set((existing ?? []).map((c) => c.employee_id));
    const toSend = isScheduledToday ? employeeIds.filter((id) => !alreadySent.has(id)) : [];

    if (toSend.length > 0) {
      const siteName = (template.sites as { name?: string } | null)?.name ?? "";
      await supabase.from("checklists").insert(
        toSend.map((employee_id) => ({
          template_id: templateId,
          company_id: companyId,
          site: siteName,
          site_id: template.site_id,
          employee_id,
          assigned_date: today,
          areas: areasForToday,
          special_note: template.special_note,
          status: "pending",
          admin_note: adminNote,
        }))
      );
    }
  }

  revalidatePath("/checklists");
  return { success: true };
}

export async function deleteAssignmentAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("checklist_assignments").delete().eq("id", id);
  revalidatePath("/checklists");
}
