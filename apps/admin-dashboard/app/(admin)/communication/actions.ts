"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";
import { uploadImageToImageKit } from "@macro/shared/imagekit";

export interface CommunicationFormState {
  error?: string;
  success?: boolean;
  id?: string;
}

/** Uploads one chat image to ImageKit and returns its public URL — keeps the private key server-only. */
export async function uploadCommunicationImageAction(formData: FormData): Promise<{ url?: string; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided." };

  try {
    const url = await uploadImageToImageKit(file, "communication");
    return { url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }
}

/**
 * Creates the thread's durable metadata row in Postgres, plus one
 * `communication_recipients` row per chosen employee — access-control
 * anchor and what the table list reads. The actual message thread (this
 * first message + every reply) lives in Firebase Firestore; the client
 * mirrors {employeeIds, companyId, siteId} into a matching Firestore
 * `conversations/{id}` doc right after this succeeds (see ChatThread.tsx).
 */
export async function createCommunicationAction(
  _prev: CommunicationFormState,
  formData: FormData
): Promise<CommunicationFormState> {
  const companyId = String(formData.get("companyId") ?? "");
  const siteId = String(formData.get("siteId") ?? "") || null;
  const employeeIds = formData.getAll("employeeIds").map(String);
  const title = String(formData.get("title") ?? "").trim();
  const priority = String(formData.get("priority") ?? "medium");

  if (!companyId || employeeIds.length === 0) return { error: "Company and at least one employee are required." };
  if (!title) return { error: "Title is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Log in again." };

  // Generate the id ourselves rather than using .select() to read it back:
  // after 0024 admins have no blanket SELECT policy on communications, and the
  // employee SELECT policy is is_communication_recipient(id) — false until the
  // recipient rows below exist. So an INSERT ... RETURNING (what .select()
  // adds) trips RLS with "new row violates row-level security policy".
  // Inserting without RETURNING sidesteps that.
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("communications")
    .insert({ id, company_id: companyId, site_id: siteId, title, priority, status: "open" });

  if (error) return { error: error.message };

  // Admin is included as a recipient too — visibility is now scoped to actual
  // participants only (no more blanket oversight), so without this the admin
  // would lose access to a thread right after starting it. Insert the admin's
  // own recipient row FIRST: it makes the thread visible under RLS, which the
  // company-scoped insert policy for the OTHER recipients relies on (that
  // policy checks the parent communications row, hidden until a recipient
  // exists).
  const { error: selfError } = await supabase
    .from("communication_recipients")
    .insert({ communication_id: id, employee_id: user.id });

  if (selfError) return { error: selfError.message };

  const otherIds = employeeIds.filter((eid) => eid && eid !== user.id);
  if (otherIds.length > 0) {
    const { error: recipientsError } = await supabase
      .from("communication_recipients")
      .insert(otherIds.map((employee_id) => ({ communication_id: id, employee_id })));

    if (recipientsError) return { error: recipientsError.message };
  }

  revalidatePath("/communication");
  return { success: true, id };
}

/** Called from the client right after a Firestore message send succeeds — keeps the table's preview/sort in sync without needing a Firebase Cloud Function. */
export async function touchCommunicationAction(id: string, preview: string): Promise<void> {
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("communications")
    .update({ last_update: preview, last_message_at: new Date().toISOString(), status: "open" })
    .eq("id", id);

  revalidatePath("/communication");
}

export async function toggleThreadStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "");
  if (!id || !nextStatus) return;

  const supabase = await createClient();
  await supabase.from("communications").update({ status: nextStatus }).eq("id", id);

  revalidatePath("/communication");
}
