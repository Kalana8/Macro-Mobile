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
 * An employee starting their own thread — the counterpart to the admin's
 * createCommunicationAction. They can pick other people at their company to
 * send it to (communication_recipients_company_insert RLS), always
 * including themselves. Metadata lands in Postgres; the client mirrors it
 * into Firestore right after (see ChatThread.tsx) and sends the first
 * message there.
 */
export async function createCommunicationAction(
  _prev: CommunicationFormState,
  formData: FormData
): Promise<CommunicationFormState> {
  const companyId = String(formData.get("companyId") ?? "");
  const siteId = String(formData.get("siteId") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();
  const priority = String(formData.get("priority") ?? "medium");
  const recipientIds = formData.getAll("recipientIds").map(String);

  if (!companyId) return { error: "Choose which company this is about." };
  if (!title) return { error: "Title is required." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Log in again." };

  const { data, error } = await supabase
    .from("communications")
    .insert({ company_id: companyId, site_id: siteId, title, priority, status: "open" })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const allRecipientIds = Array.from(new Set([user.id, ...recipientIds]));
  const { error: recipientError } = await supabase
    .from("communication_recipients")
    .insert(allRecipientIds.map((employee_id) => ({ communication_id: data.id, employee_id })));

  if (recipientError) return { error: recipientError.message };

  revalidatePath("/communication");
  return { success: true, id: data.id };
}

/** Called from the client right after a Firestore message send succeeds — keeps the list's preview/sort in sync without needing a Firebase Cloud Function. */
export async function touchCommunicationAction(id: string, preview: string): Promise<void> {
  if (!id) return;
  const supabase = await createClient();
  await supabase
    .from("communications")
    .update({ last_update: preview, last_message_at: new Date().toISOString(), status: "open" })
    .eq("id", id);

  revalidatePath("/communication");
}

/** Any recipient can close/reopen a thread once it's done — RLS (communications_recipient_update) scopes this to threads they're actually part of. */
export async function toggleThreadStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "");
  if (!id || !nextStatus) return;

  const supabase = await createClient();
  await supabase.from("communications").update({ status: nextStatus }).eq("id", id);

  revalidatePath("/communication");
  revalidatePath(`/communication/${id}`);
}
