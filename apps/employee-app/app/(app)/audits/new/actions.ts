"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";
import { uploadImageToImageKit } from "@macro/shared/imagekit";

export interface CreateAuditState {
  error?: string;
  success?: boolean;
}

/** Uploads one audit photo to ImageKit and returns its public URL — keeps the private key server-only. */
export async function uploadAuditImageAction(formData: FormData): Promise<{ url?: string; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided." };

  try {
    const url = await uploadImageToImageKit(file, "audits");
    return { url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }
}

export async function createAuditAction(
  _prev: CreateAuditState,
  formData: FormData
): Promise<CreateAuditState> {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const location = String(formData.get("location") ?? "").trim();
  const priority = String(formData.get("priority") ?? "medium");
  const notes = String(formData.get("notes") ?? "").trim();
  const companyId = String(formData.get("companyId") ?? "");

  if (!title || !date || !companyId) {
    return { error: "Title, date and company are required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Log in again." };

  const images = formData.getAll("images").map(String).filter(Boolean);

  const { error } = await supabase.from("audits").insert({
    employee_id: user.id,
    company_id: companyId,
    title,
    description,
    date,
    location,
    priority,
    notes,
    images,
    status: "submit",
  });

  if (error) return { error: error.message };

  revalidatePath("/audits");
  return { success: true };
}
