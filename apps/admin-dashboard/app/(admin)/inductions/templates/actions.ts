"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";
import { uploadImageToImageKit } from "@macro/shared/imagekit";
import type { InductionFormSection, InductionQuestion, InductionTemplateStatus } from "@macro/shared/types";
import { getCurrentAdmin } from "@/lib/session";

export interface TemplateFormState {
  error?: string;
  success?: boolean;
  id?: string;
}

async function requireEmployeeId(): Promise<string> {
  const admin = await getCurrentAdmin();
  if (!admin?.employee) throw new Error("Not signed in.");
  return admin.employee.id;
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** New assignments start with one pre-filled section, ready to edit — not a blank canvas. */
function defaultSections(): InductionFormSection[] {
  return [
    {
      id: newId("section"),
      title: "General Induction",
      description: "Please answer the following questions before starting work at this site.",
      questions: [
        { id: newId("q"), type: "short_answer", title: "Please type your full name to confirm your identity.", required: true },
        { id: newId("q"), type: "yes_no", title: "Have you read and understood the site safety rules?", required: true },
        { id: newId("q"), type: "yes_no", title: "Do you understand the PPE requirements for this site?", required: true },
        {
          id: newId("q"),
          type: "checkboxes",
          title: "Which of the following hazards have you been made aware of?",
          required: true,
          options: ["Moving vehicles", "Working at height", "Manual handling", "Electrical hazards"],
        },
      ],
    },
  ];
}

export async function createTemplateAction(_prev: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  if (!name) return { error: "Assignment name is required." };

  const createdBy = await requireEmployeeId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("induction_templates")
    .insert({ name, description, category, status: "draft", sections: defaultSections(), created_by: createdBy })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Couldn't create the assignment." };

  revalidatePath("/inductions/templates");
  return { success: true, id: data.id };
}

export async function updateTemplateDetailsAction(_prev: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const status = String(formData.get("status") ?? "draft") as InductionTemplateStatus;
  const removeCoverImage = formData.get("removeCoverImage") === "on";
  const coverImage = formData.get("coverImage");
  if (!id || !name) return { error: "Assignment name is required." };
  if (status !== "draft" && status !== "published") return { error: "Invalid status." };

  const update: Record<string, unknown> = { name, description, category, status, updated_at: new Date().toISOString() };

  if (removeCoverImage) {
    update.cover_image_url = null;
  } else if (coverImage instanceof File && coverImage.size > 0) {
    try {
      update.cover_image_url = await uploadImageToImageKit(coverImage, "inductions/covers");
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Couldn't upload the cover image." };
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("induction_templates").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/inductions/templates");
  revalidatePath(`/inductions/templates/${id}`);
  return { success: true };
}

/** Full Sections→Questions tree replace — the builder always sends the whole current tree, never a partial patch. */
export async function updateTemplateSectionsAction(templateId: string, sections: InductionFormSection[]): Promise<TemplateFormState> {
  if (!templateId) return { error: "Missing assignment." };

  const cleaned: InductionFormSection[] = sections
    .map((s) => ({
      ...s,
      title: s.title.trim(),
      questions: s.questions
        .map((q) => ({ ...q, title: q.title.trim() } as InductionQuestion))
        .filter((q) => q.title),
    }))
    .filter((s) => s.title || s.questions.length > 0);

  if (cleaned.length === 0) return { error: "Add at least one section with a question." };
  if (cleaned.every((s) => s.questions.length === 0)) return { error: "Add at least one question." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("induction_templates")
    .update({ sections: cleaned, updated_at: new Date().toISOString() })
    .eq("id", templateId);

  if (error) return { error: error.message };

  revalidatePath("/inductions/templates");
  revalidatePath(`/inductions/templates/${templateId}`);
  return { success: true };
}

export async function setTemplateStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as InductionTemplateStatus;
  if (!id || (status !== "draft" && status !== "published")) return;

  const supabase = await createClient();
  await supabase.from("induction_templates").update({ status, updated_at: new Date().toISOString() }).eq("id", id);

  revalidatePath("/inductions/templates");
  revalidatePath(`/inductions/templates/${id}`);
}

export async function duplicateTemplateAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: template } = await supabase.from("induction_templates").select("*").eq("id", id).maybeSingle();
  if (!template) return;

  const createdBy = await requireEmployeeId();
  await supabase.from("induction_templates").insert({
    name: `${template.name} (Copy)`,
    description: template.description,
    category: template.category,
    status: "draft",
    sections: template.sections,
    cover_image_url: template.cover_image_url,
    created_by: createdBy,
  });

  revalidatePath("/inductions/templates");
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // Invitations already created from this template keep working — their
  // template_id just goes null (see ON DELETE SET NULL) — so deleting a
  // template never breaks an in-flight invitation.
  await supabase.from("induction_templates").delete().eq("id", id);

  revalidatePath("/inductions/templates");
}
