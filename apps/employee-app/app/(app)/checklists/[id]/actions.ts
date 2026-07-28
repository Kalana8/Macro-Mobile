"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";
import { uploadImageToImageKit } from "@macro/shared/imagekit";
import type { ChecklistArea } from "@macro/shared/types";

export interface SubmitChecklistState {
  error?: string;
  success?: boolean;
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

/** Marks subtasks done, saves notes/images, and sends the checklist to admin for review. */
export async function submitChecklistAction(
  _prev: SubmitChecklistState,
  formData: FormData
): Promise<SubmitChecklistState> {
  const checklistId = String(formData.get("checklistId") ?? "");
  const areasRaw = String(formData.get("areasJson") ?? "[]");
  const notes = String(formData.get("notes") ?? "").trim();
  const images = formData.getAll("images").map(String).filter(Boolean);

  if (!checklistId) return { error: "Missing checklist." };

  let areas: ChecklistArea[];
  try {
    areas = JSON.parse(areasRaw);
  } catch {
    return { error: "Invalid checklist data." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("checklists")
    .update({
      areas,
      notes,
      images,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", checklistId);

  if (error) return { error: error.message };

  revalidatePath(`/checklists/${checklistId}`);
  revalidatePath("/checklists");
  return { success: true };
}
