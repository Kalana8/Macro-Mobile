"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";
import { uploadImageToImageKit } from "@macro/shared/imagekit";
import type { InductionFormSection, InductionQuestion, InductionTemplateStatus, InductionTrainingSlide, InductionType } from "@macro/shared/types";

const INDUCTION_TYPES: InductionType[] = ["whs", "site_specific", "contractor", "visitor", "equipment"];
import { getCurrentAdmin } from "@/lib/session";

export interface AssessmentSettings {
  pass_mark_percent: number;
  max_attempts: number | null;
  retake_delay_hours: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  show_correct_answers: boolean;
  certificate_enabled: boolean;
}

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
        {
          id: newId("q"),
          type: "yes_no",
          title: "Have you read and understood the site safety rules?",
          required: true,
          correctAnswers: ["Yes"],
          marks: 1,
        },
        {
          id: newId("q"),
          type: "yes_no",
          title: "Do you understand the PPE requirements for this site?",
          required: true,
          correctAnswers: ["Yes"],
          marks: 1,
        },
        {
          id: newId("q"),
          type: "checkboxes",
          title: "Which of the following hazards have you been made aware of?",
          required: true,
          options: ["Moving vehicles", "Working at height", "Manual handling", "Electrical hazards"],
          correctAnswers: ["Moving vehicles", "Working at height", "Manual handling", "Electrical hazards"],
          marks: 1,
        },
      ],
    },
  ];
}

/** New assignments start with a couple of placeholder training slides too, so Training Content isn't a blank tab. */
function defaultTrainingSlides(): InductionTrainingSlide[] {
  return [
    { id: newId("slide"), title: "Welcome to Site Safety Induction", content: "An overview of what this induction covers and why it matters.", minSeconds: 20, canvasJson: null },
    { id: newId("slide"), title: "Site Rules", content: "The general rules everyone must follow while on site.", minSeconds: 30, canvasJson: null },
  ];
}

export async function createTemplateAction(_prev: TemplateFormState, formData: FormData): Promise<TemplateFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const inductionTypeRaw = String(formData.get("inductionType") ?? "whs");
  const inductionType: InductionType = INDUCTION_TYPES.includes(inductionTypeRaw as InductionType) ? (inductionTypeRaw as InductionType) : "whs";
  const isMandatory = formData.get("isMandatory") === "on";
  if (!name) return { error: "Assignment name is required." };

  const createdBy = await requireEmployeeId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("induction_templates")
    .insert({
      name,
      description,
      category,
      induction_type: inductionType,
      is_mandatory: isMandatory,
      status: "draft",
      sections: defaultSections(),
      training_slides: defaultTrainingSlides(),
      created_by: createdBy,
    })
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
  const inductionTypeRaw = String(formData.get("inductionType") ?? "whs");
  const inductionType: InductionType = INDUCTION_TYPES.includes(inductionTypeRaw as InductionType) ? (inductionTypeRaw as InductionType) : "whs";
  const isMandatory = formData.get("isMandatory") === "on";
  const status = String(formData.get("status") ?? "draft") as InductionTemplateStatus;
  const removeCoverImage = formData.get("removeCoverImage") === "on";
  const coverImage = formData.get("coverImage");
  if (!id || !name) return { error: "Assignment name is required." };
  if (status !== "draft" && status !== "published") return { error: "Invalid status." };

  const update: Record<string, unknown> = {
    name,
    description,
    category,
    induction_type: inductionType,
    is_mandatory: isMandatory,
    status,
    updated_at: new Date().toISOString(),
  };

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

/**
 * Full-tree replace of everything the builder's two tabs (Training Content +
 * Assessment) manage — sections/questions, training slides, and the
 * assessment settings — saved together in one call so "Save Draft" always
 * persists a self-consistent snapshot rather than three independently-timed
 * partial writes.
 */
export async function updateAssignmentContentAction(
  templateId: string,
  sections: InductionFormSection[],
  trainingSlides: InductionTrainingSlide[],
  settings: AssessmentSettings
): Promise<TemplateFormState> {
  if (!templateId) return { error: "Missing assignment." };

  const cleanedSections: InductionFormSection[] = sections
    .map((s) => ({
      ...s,
      title: s.title.trim(),
      questions: s.questions
        .map((q) => ({ ...q, title: q.title.trim() } as InductionQuestion))
        .filter((q) => q.title),
    }))
    .filter((s) => s.title || s.questions.length > 0);

  if (cleanedSections.length === 0) return { error: "Add at least one section with a question." };
  if (cleanedSections.every((s) => s.questions.length === 0)) return { error: "Add at least one question." };

  const cleanedSlides = trainingSlides
    .map((s) => ({ ...s, title: s.title.trim() }))
    .filter((s) => s.title || s.content?.trim() || (s.canvasJson && Object.keys(s.canvasJson).length > 0));
  if (settings.pass_mark_percent < 1 || settings.pass_mark_percent > 100) return { error: "Pass mark must be between 1 and 100." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("induction_templates")
    .update({
      sections: cleanedSections,
      training_slides: cleanedSlides,
      pass_mark_percent: settings.pass_mark_percent,
      max_attempts: settings.max_attempts,
      retake_delay_hours: settings.retake_delay_hours,
      shuffle_questions: settings.shuffle_questions,
      shuffle_options: settings.shuffle_options,
      show_correct_answers: settings.show_correct_answers,
      certificate_enabled: settings.certificate_enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);

  if (error) return { error: error.message };

  revalidatePath("/inductions/templates");
  revalidatePath(`/inductions/templates/${templateId}`);
  return { success: true };
}

/** Uploads one training-slide image, called directly from the builder (not a `<form>`) — used for inline "add image" while editing a slide. */
export async function uploadTemplateAssetAction(formData: FormData): Promise<{ url?: string; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file provided." };
  try {
    const url = await uploadImageToImageKit(file, "inductions/training-slides");
    return { url };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Upload failed." };
  }
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
    induction_type: template.induction_type,
    is_mandatory: template.is_mandatory,
    status: "draft",
    sections: template.sections,
    training_slides: template.training_slides,
    pass_mark_percent: template.pass_mark_percent,
    max_attempts: template.max_attempts,
    retake_delay_hours: template.retake_delay_hours,
    shuffle_questions: template.shuffle_questions,
    shuffle_options: template.shuffle_options,
    show_correct_answers: template.show_correct_answers,
    certificate_enabled: template.certificate_enabled,
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
