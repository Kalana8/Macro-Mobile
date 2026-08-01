"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Purges the client Router Cache for every route — without this, a plain
  // <Link> navigation after the next account logs in in this same tab can
  // still serve a previously-cached page (e.g. Communication) rendered for
  // the account that just logged out.
  revalidatePath("/", "layout");
  redirect("/login");
}
