"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";

export interface CommunicationFormState {
  error?: string;
  success?: boolean;
  id?: string;
}

/**
 * An employee starting their own thread ("Report an issue") — the
 * counterpart to the admin's createCommunicationAction. Metadata lands in
 * Postgres; the client mirrors it into Firestore right after (see
 * ChatThread.tsx) and sends the first message there.
 */
export async function createCommunicationAction(
  _prev: CommunicationFormState,
  formData: FormData
): Promise<CommunicationFormState> {
  const companyId = String(formData.get("companyId") ?? "");
  const siteId = String(formData.get("siteId") ?? "") || null;
  const title = String(formData.get("title") ?? "").trim();
  const priority = String(formData.get("priority") ?? "medium");

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

  // An employee reporting their own issue is always its (initial) recipient
  // — RLS only lets them add themselves, not anyone else.
  const { error: recipientError } = await supabase
    .from("communication_recipients")
    .insert({ communication_id: data.id, employee_id: user.id });

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
