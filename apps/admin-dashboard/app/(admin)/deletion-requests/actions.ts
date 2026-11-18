"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";
import { getCurrentAdmin } from "@/lib/session";

/** Marks a request done (the account has been deleted), or reopens it. */
export async function setDeletionRequestStatusAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const status = formData.get("status") === "new" ? "new" : "done";
  if (!id) return;
  const admin = await getCurrentAdmin();
  if (!admin?.employee) return;
  const supabase = await createClient();
  await supabase
    .from("account_deletion_requests")
    .update(status === "done" ? { status, handled_by: admin.employee.id, handled_at: new Date().toISOString() } : { status, handled_by: null, handled_at: null })
    .eq("id", id);
  revalidatePath("/deletion-requests");
}
