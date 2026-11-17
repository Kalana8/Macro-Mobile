"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";

/** Marks photos sent to the signed-in admin as seen. RLS only lets a recipient stamp their own row. */
export async function markPhotosSeenAction(shareIds: string[]): Promise<void> {
  if (shareIds.length === 0) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("photo_share_recipients")
    .update({ seen_at: new Date().toISOString() })
    .eq("recipient_id", user.id)
    .is("seen_at", null)
    .in("share_id", shareIds);
  revalidatePath("/photos");
}

export interface PhotoShareState {
  error?: string;
  success?: boolean;
}

/**
 * Records photos the signed-in admin has already uploaded to their own folder
 * in the shared-photos bucket. RLS (0044) checks the paths are theirs and that
 * every recipient is someone they may send to.
 */
export async function createPhotoShareAction(input: {
  id: string;
  companyId: string | null;
  note: string;
  paths: string[];
  recipientIds: string[];
}): Promise<PhotoShareState> {
  const note = input.note.trim();
  if (input.paths.length === 0 || input.paths.length > 10) return { error: "Add between 1 and 10 photos." };
  if (input.recipientIds.length === 0) return { error: "Choose who to send them to." };
  if (note.length > 1000) return { error: "Keep the note under 1,000 characters." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Log in again." };

  const { error: shareError } = await supabase
    .from("photo_shares")
    .insert({ id: input.id, sender_id: user.id, company_id: input.companyId, note, images: input.paths });
  if (shareError) return { error: "Couldn’t send these photos. Try again." };

  const { error: recipientError } = await supabase
    .from("photo_share_recipients")
    .insert(input.recipientIds.map((recipient_id) => ({ share_id: input.id, recipient_id })));
  if (recipientError) {
    // Don't leave a share nobody can see.
    await supabase.from("photo_shares").delete().eq("id", input.id);
    return { error: "Couldn’t send to everyone you chose. Try again." };
  }

  revalidatePath("/photos");
  return { success: true };
}
