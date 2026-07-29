"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@macro/shared/supabase/server";
import { uploadImageToImageKit } from "@macro/shared/imagekit";
import type { ChecklistArea } from "@macro/shared/types";

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
  const site = String(formData.get("site") ?? "").trim();
  const areasRaw = String(formData.get("areasJson") ?? "[]");
  const templateId = String(formData.get("templateId") ?? "");

  if (!companyId || !site) return { error: "Company and site are required." };

  let draft: DraftArea[];
  try {
    draft = JSON.parse(areasRaw);
  } catch {
    return { error: "Invalid template data." };
  }
  const areas = buildAreas(draft);
  if (areas.length === 0) return { error: "Add at least one main area with a name." };

  const supabase = await createClient();
  const { error } = templateId
    ? await supabase.from("checklist_templates").update({ company_id: companyId, site, areas }).eq("id", templateId)
    : await supabase.from("checklist_templates").insert({ company_id: companyId, site, areas });

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

/**
 * Standing assignment (no date) — links an employee to a template. From
 * then on, the daily `checklists` instance for subsequent days is
 * auto-created by the scheduled generate_due_checklists() function
 * whenever the company's visit_days/visit_time comes around. But an admin
 * assigning someone expects it to show up for the employee right away, not
 * wait for that schedule — so this also sends today's instance immediately.
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
    .select("site, areas")
    .eq("id", templateId)
    .maybeSingle();

  if (template) {
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("checklists")
      .select("employee_id")
      .eq("template_id", templateId)
      .eq("assigned_date", today)
      .in("employee_id", employeeIds);

    const alreadySent = new Set((existing ?? []).map((c) => c.employee_id));
    const toSend = employeeIds.filter((id) => !alreadySent.has(id));

    if (toSend.length > 0) {
      await supabase.from("checklists").insert(
        toSend.map((employee_id) => ({
          template_id: templateId,
          company_id: companyId,
          site: template.site,
          employee_id,
          assigned_date: today,
          areas: template.areas,
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
