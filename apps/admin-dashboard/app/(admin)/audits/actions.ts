"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@macro/shared/supabase/server";
import type { AuditMainItem, AuditRating } from "@macro/shared/types";

export interface AuditFormState {
  error?: string;
  success?: boolean;
}

interface DraftMainAudit {
  title: string;
  comment: string;
  subAudits: string[];
}

/** Admin-authored audit — mirrors the "Add Audit" modal (repeatable main audits + sub-audits). */
export async function createAuditAction(
  _prev: AuditFormState,
  formData: FormData
): Promise<AuditFormState> {
  const companyId = String(formData.get("companyId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  const date = String(formData.get("date") ?? "");
  const mainAuditsRaw = String(formData.get("mainAuditsJson") ?? "[]");

  if (!companyId || !employeeId || !date) {
    return { error: "Company, employee and date are required." };
  }

  let draft: DraftMainAudit[];
  try {
    draft = JSON.parse(mainAuditsRaw);
  } catch {
    return { error: "Invalid audit data." };
  }

  const mainAudits: AuditMainItem[] = draft
    .filter((m) => m.title.trim())
    .map((m) => ({
      id: randomUUID(),
      title: m.title.trim(),
      comment: m.comment.trim(),
      marks: null,
      images: [],
      sub_audits: m.subAudits
        .filter((s) => s.trim())
        .map((text) => ({ id: randomUUID(), text: text.trim(), result: "" as AuditRating })),
    }));

  if (mainAudits.length === 0) {
    return { error: "Add at least one main audit with a title." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("audits").insert({
    company_id: companyId,
    employee_id: employeeId,
    date,
    title: mainAudits[0].title,
    status: "submit",
    main_audits: mainAudits,
  });

  if (error) return { error: error.message };

  revalidatePath("/audits");
  return { success: true };
}

export async function deleteAuditAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("audits").delete().eq("id", id);

  revalidatePath("/audits");
}

/** Full replace of an audit's main_audits (ratings/marks/comments) from the Audit Detail modal. */
export async function updateAuditRatingsAction(
  _prev: AuditFormState,
  formData: FormData
): Promise<AuditFormState> {
  const auditId = String(formData.get("auditId") ?? "");
  const mainAuditsRaw = String(formData.get("mainAuditsJson") ?? "[]");
  const finalMarksRaw = formData.get("finalMarks");
  const finalMarks = finalMarksRaw && String(finalMarksRaw).trim() !== "" ? Number(finalMarksRaw) : null;

  if (!auditId) return { error: "Missing audit." };

  let mainAudits: AuditMainItem[];
  try {
    mainAudits = JSON.parse(mainAuditsRaw);
  } catch {
    return { error: "Invalid audit data." };
  }

  const allRated = mainAudits.every((m) => m.sub_audits.every((s) => s.result));
  const status = allRated && mainAudits.length > 0 ? "verify" : "submit";

  const supabase = await createClient();
  const { error } = await supabase
    .from("audits")
    .update({ main_audits: mainAudits, final_marks: finalMarks, status })
    .eq("id", auditId);

  if (error) return { error: error.message };

  revalidatePath("/audits");
  return { success: true };
}

/** Marks the audit complete and notifies the selected employees. */
export async function sendAuditResultsAction(
  _prev: AuditFormState,
  formData: FormData
): Promise<AuditFormState> {
  const auditId = String(formData.get("auditId") ?? "");
  const recipientIds = formData.getAll("recipientIds").map(String);

  if (!auditId || recipientIds.length === 0) {
    return { error: "Select at least one recipient." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("audits")
    .update({ status: "complete", sent_to: recipientIds })
    .eq("id", auditId);

  if (error) return { error: error.message };

  revalidatePath("/audits");
  return { success: true };
}
