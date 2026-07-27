"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";

export interface CreateAuditState {
  error?: string;
  success?: boolean;
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

  // TODO(feature-pass): wire Camera/Gallery image upload to the
  // `audit-images` Storage bucket (path prefix `{employee_id}/...` per the
  // RLS policy in supabase/migrations/0002_rls.sql) — `images` stays empty
  // until that's implemented.
  const { error } = await supabase.from("audits").insert({
    employee_id: user.id,
    company_id: companyId,
    title,
    description,
    date,
    location,
    priority,
    notes,
    status: "submit",
  });

  if (error) return { error: error.message };

  revalidatePath("/audits");
  return { success: true };
}
