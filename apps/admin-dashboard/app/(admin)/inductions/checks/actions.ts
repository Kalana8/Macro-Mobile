"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";
import { getCurrentAdmin } from "@/lib/session";

async function requireAdmin() {
  const admin = await getCurrentAdmin();
  if (!admin?.employee) throw new Error("Not signed in.");
  return admin.employee.id;
}

function refresh() {
  revalidatePath("/inductions/checks");
  revalidatePath("/employees");
}

/** A short-lived link to an employee's document. Storage only lets admins (and the employee) read it. */
export async function checkDocumentUrlAction(checkId: string): Promise<{ url?: string; error?: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { data: row } = await supabase.from("employee_checks").select("document_path").eq("id", checkId).maybeSingle();
  if (!row) return { error: "Document not found." };
  const { data, error } = await supabase.storage.from("employee-checks").createSignedUrl(row.document_path, 300);
  if (error || !data) return { error: "Couldn't open the document." };
  return { url: data.signedUrl };
}

export async function reviewCheckAction(formData: FormData): Promise<{ error?: string }> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const expiresOn = String(formData.get("expiresOn") ?? "") || null;
  const reviewNote = String(formData.get("reviewNote") ?? "").trim() || null;
  if (!id || (decision !== "approved" && decision !== "rejected")) return { error: "Choose approve or send back." };
  if (decision === "rejected" && !reviewNote) return { error: "Say what needs fixing so the employee knows." };
  if (expiresOn && !/^\d{4}-\d{2}-\d{2}$/.test(expiresOn)) return { error: "Pick a valid expiry date." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("employee_checks")
    .update(decision === "approved" ? { status: "approved", expires_on: expiresOn, review_note: reviewNote } : { status: "rejected", review_note: reviewNote })
    .eq("id", id);
  if (error) return { error: error.message };
  refresh();
  return {};
}

export async function addCheckTypeAction(formData: FormData): Promise<{ error?: string }> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { error: "Give the check a name." };
  const supabase = await createClient();
  const { data: last } = await supabase.from("check_types").select("sort").order("sort", { ascending: false }).limit(1).maybeSingle();
  const { error } = await supabase.from("check_types").insert({ name, description, sort: (last?.sort ?? 0) + 1 });
  if (error) return { error: /duplicate|unique/i.test(error.message) ? "There's already a check with that name." : error.message };
  refresh();
  return {};
}

/** Turning a check off stops asking for it; documents already handed in stay. */
export async function setCheckTypeActiveAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const active = formData.get("active") === "true";
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("check_types").update({ active }).eq("id", id);
  refresh();
}
