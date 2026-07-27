"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@macro/shared/supabase/server";
import type { ChecklistArea } from "@macro/shared/types";

export interface ChecklistFormState {
  error?: string;
  success?: boolean;
}

interface DraftArea {
  mainArea: string;
  note: string;
  subtasks: string[];
}

function buildAreas(draft: DraftArea[]): ChecklistArea[] {
  return draft
    .filter((a) => a.mainArea.trim())
    .map((a) => ({
      main_area: a.mainArea.trim(),
      note: a.note.trim(),
      images: [],
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

export async function assignChecklistAction(
  _prev: ChecklistFormState,
  formData: FormData
): Promise<ChecklistFormState> {
  const templateId = String(formData.get("templateId") ?? "");
  const companyId = String(formData.get("companyId") ?? "");
  const site = String(formData.get("site") ?? "");
  const date = String(formData.get("date") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;
  const employeeIds = formData.getAll("employeeIds").map(String);
  const areasJson = String(formData.get("areasJson") ?? "[]");

  if (!templateId || !companyId || employeeIds.length === 0 || !date) {
    return { error: "Company, site, date and at least one employee are required." };
  }

  let templateAreas: ChecklistArea[];
  try {
    templateAreas = JSON.parse(areasJson);
  } catch {
    return { error: "Invalid checklist data." };
  }

  // Deep-copy the template's areas per assignment, seeding `done: false` —
  // an assigned checklist snapshots the template rather than referencing it live.
  const areasForInstance = (): ChecklistArea[] =>
    templateAreas.map((area) => ({
      ...area,
      subtasks: area.subtasks.map((s) => ({ ...s, id: randomUUID(), done: false })),
    }));

  const supabase = await createClient();
  const { error } = await supabase.from("checklists").insert(
    employeeIds.map((employee_id) => ({
      template_id: templateId,
      company_id: companyId,
      site,
      employee_id,
      assigned_date: date,
      areas: areasForInstance(),
      status: "pending",
      admin_note: adminNote,
    }))
  );

  if (error) return { error: error.message };

  revalidatePath("/checklists");
  revalidatePath("/companies");
  return { success: true };
}
