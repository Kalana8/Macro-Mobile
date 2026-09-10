"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";
import { getCurrentAdmin } from "@/lib/session";
import { addDuration, generateRawToken, hashToken } from "@/lib/inductionToken";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

async function requireEmployeeId(): Promise<string> {
  const admin = await getCurrentAdmin();
  if (!admin?.employee) throw new Error("Not signed in.");
  return admin.employee.id;
}

// ---------------------------------------------------------------------------
// Create invitation
// ---------------------------------------------------------------------------

export interface CreateInductionResult extends ActionResult {
  rawToken?: string;
}

export async function createInductionAction(_prev: CreateInductionResult, formData: FormData): Promise<CreateInductionResult> {
  const employeeId = String(formData.get("employeeId") ?? "");
  const siteId = String(formData.get("siteId") ?? "");
  const templateId = String(formData.get("templateId") ?? "") || null;
  const expiryOption = String(formData.get("expiryOption") ?? "7d");
  const customExpiresAt = String(formData.get("customExpiresAt") ?? "");

  if (!employeeId || !siteId) return { error: "Select an employee and a site." };
  if (!templateId) return { error: "Select an induction template — create one first if none exist yet." };

  const now = new Date();
  let expiresAt: Date;
  switch (expiryOption) {
    case "24h": expiresAt = addDuration(now, 24, "hours"); break;
    case "48h": expiresAt = addDuration(now, 48, "hours"); break;
    case "3d": expiresAt = addDuration(now, 3, "days"); break;
    case "14d": expiresAt = addDuration(now, 14, "days"); break;
    case "30d": expiresAt = addDuration(now, 30, "days"); break;
    case "custom": {
      if (!customExpiresAt) return { error: "Pick a custom expiration date/time." };
      expiresAt = new Date(customExpiresAt);
      if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
        return { error: "Custom expiration must be a valid date/time in the future." };
      }
      break;
    }
    case "7d":
    default:
      expiresAt = addDuration(now, 7, "days");
  }

  const performedBy = await requireEmployeeId();
  const rawToken = generateRawToken();
  const supabase = await createClient();

  const { data: token, error } = await supabase
    .from("induction_tokens")
    .insert({
      employee_id: employeeId,
      site_id: siteId,
      template_id: templateId,
      token_hash: hashToken(rawToken),
      expires_at: expiresAt.toISOString(),
      created_by: performedBy,
    })
    .select("id")
    .single();

  if (error || !token) return { error: error?.message ?? "Couldn't create the invitation." };

  await supabase.from("induction_token_history").insert({
    token_id: token.id,
    action: "created",
    new_expires_at: expiresAt.toISOString(),
    performed_by: performedBy,
  });

  revalidatePath("/inductions");
  return { success: true, rawToken };
}

// ---------------------------------------------------------------------------
// Extend expiration
// ---------------------------------------------------------------------------

export async function extendInductionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const tokenId = String(formData.get("tokenId") ?? "");
  const extendOption = String(formData.get("extendOption") ?? "");
  const customExpiresAt = String(formData.get("customExpiresAt") ?? "");
  if (!tokenId) return { error: "Missing invitation." };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("induction_tokens")
    .select("id, expires_at, status")
    .eq("id", tokenId)
    .maybeSingle();
  if (fetchError || !existing) return { error: "Invitation not found." };

  // Extending resets from now, not from the old expiry — an already-expired
  // link being extended should become valid for a fresh window starting now,
  // not silently still-expired because the base was in the past.
  const base = new Date();
  let newExpiresAt: Date;
  switch (extendOption) {
    case "24h": newExpiresAt = addDuration(base, 24, "hours"); break;
    case "3d": newExpiresAt = addDuration(base, 3, "days"); break;
    case "30d": newExpiresAt = addDuration(base, 30, "days"); break;
    case "custom": {
      if (!customExpiresAt) return { error: "Pick a custom expiration date/time." };
      newExpiresAt = new Date(customExpiresAt);
      if (Number.isNaN(newExpiresAt.getTime()) || newExpiresAt <= base) {
        return { error: "Custom expiration must be a valid date/time in the future." };
      }
      break;
    }
    case "7d":
    default:
      newExpiresAt = addDuration(base, 7, "days");
  }

  const performedBy = await requireEmployeeId();
  const { error } = await supabase
    .from("induction_tokens")
    .update({ expires_at: newExpiresAt.toISOString(), status: "active" })
    .eq("id", tokenId);
  if (error) return { error: error.message };

  await supabase.from("induction_token_history").insert({
    token_id: tokenId,
    action: "extended",
    old_expires_at: existing.expires_at,
    new_expires_at: newExpiresAt.toISOString(),
    performed_by: performedBy,
  });

  revalidatePath("/inductions");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Regenerate link — revokes the old token, creates a brand new one.
// ---------------------------------------------------------------------------

export async function regenerateInductionAction(_prev: CreateInductionResult, formData: FormData): Promise<CreateInductionResult> {
  const tokenId = String(formData.get("tokenId") ?? "");
  if (!tokenId) return { error: "Missing invitation." };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("induction_tokens")
    .select("id, employee_id, site_id, template_id, expires_at")
    .eq("id", tokenId)
    .maybeSingle();
  if (fetchError || !existing) return { error: "Invitation not found." };

  const performedBy = await requireEmployeeId();

  const { error: revokeError } = await supabase
    .from("induction_tokens")
    .update({ status: "revoked" })
    .eq("id", tokenId);
  if (revokeError) return { error: revokeError.message };

  await supabase.from("induction_token_history").insert({
    token_id: tokenId,
    action: "regenerated",
    old_expires_at: existing.expires_at,
    performed_by: performedBy,
    note: "Replaced by a newly generated link.",
  });

  const rawToken = generateRawToken();
  const expiresAt = addDuration(new Date(), 7, "days");
  const { data: newToken, error: createError } = await supabase
    .from("induction_tokens")
    .insert({
      employee_id: existing.employee_id,
      site_id: existing.site_id,
      template_id: existing.template_id,
      token_hash: hashToken(rawToken),
      expires_at: expiresAt.toISOString(),
      created_by: performedBy,
    })
    .select("id")
    .single();
  if (createError || !newToken) return { error: createError?.message ?? "Couldn't generate the new link." };

  await supabase.from("induction_token_history").insert({
    token_id: newToken.id,
    action: "created",
    new_expires_at: expiresAt.toISOString(),
    performed_by: performedBy,
    note: `Regenerated from invitation ${tokenId}.`,
  });

  revalidatePath("/inductions");
  return { success: true, rawToken };
}

export async function revokeInductionAction(formData: FormData): Promise<void> {
  const tokenId = String(formData.get("tokenId") ?? "");
  if (!tokenId) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("induction_tokens")
    .select("expires_at")
    .eq("id", tokenId)
    .maybeSingle();

  const performedBy = await requireEmployeeId();
  await supabase.from("induction_tokens").update({ status: "revoked" }).eq("id", tokenId);
  await supabase.from("induction_token_history").insert({
    token_id: tokenId,
    action: "revoked",
    old_expires_at: existing?.expires_at ?? null,
    performed_by: performedBy,
  });

  revalidatePath("/inductions");
}

// ---------------------------------------------------------------------------
// Approve / reject a submitted induction
// ---------------------------------------------------------------------------

export async function approveSubmissionAction(formData: FormData): Promise<void> {
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) return;

  const performedBy = await requireEmployeeId();
  const supabase = await createClient();

  await supabase
    .from("induction_submissions")
    .update({ status: "approved", reviewed_by: performedBy, reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);

  await supabase
    .from("induction_certificates")
    .update({ status: "active" })
    .eq("submission_id", submissionId);

  revalidatePath("/inductions");
  revalidatePath("/inductions/submissions");
}

export async function rejectSubmissionAction(formData: FormData): Promise<void> {
  const submissionId = String(formData.get("submissionId") ?? "");
  const reviewNote = String(formData.get("reviewNote") ?? "").trim() || null;
  if (!submissionId) return;

  const performedBy = await requireEmployeeId();
  const supabase = await createClient();

  await supabase
    .from("induction_submissions")
    .update({ status: "rejected", reviewed_by: performedBy, reviewed_at: new Date().toISOString(), review_note: reviewNote })
    .eq("id", submissionId);

  await supabase
    .from("induction_certificates")
    .update({ status: "revoked" })
    .eq("submission_id", submissionId);

  revalidatePath("/inductions");
  revalidatePath("/inductions/submissions");
}

/** Explicit admin override — marks a submission/certificate expired ahead of the automatic date-based check, e.g. a site policy change that invalidates an otherwise still-valid certificate early. */
export async function markSubmissionExpiredAction(formData: FormData): Promise<void> {
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) return;

  const performedBy = await requireEmployeeId();
  const supabase = await createClient();

  await supabase
    .from("induction_submissions")
    .update({ status: "expired", reviewed_by: performedBy, reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);

  await supabase.from("induction_certificates").update({ status: "expired" }).eq("submission_id", submissionId);

  revalidatePath("/inductions");
  revalidatePath("/inductions/submissions");
}

/** Row-level action on the Certificates page — revoke an otherwise-valid certificate, or reactivate a mistakenly revoked one. Does not touch the underlying submission's pass/fail record. */
export async function setCertificateStatusAction(formData: FormData): Promise<void> {
  const certificateId = String(formData.get("certificateId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!certificateId || (status !== "active" && status !== "revoked" && status !== "expired")) return;

  await requireEmployeeId();
  const supabase = await createClient();
  await supabase.from("induction_certificates").update({ status }).eq("id", certificateId);

  revalidatePath("/inductions/certificates");
  revalidatePath("/inductions/submissions");
}

/** Requests a fresh submission from the employee — clears the completed submission's answers status back to nothing usable and revokes the token so a brand-new invitation is needed; used when an admin needs the employee to redo an induction (e.g. content changed materially). */
export async function requestResubmissionAction(formData: FormData): Promise<void> {
  const tokenId = String(formData.get("tokenId") ?? "");
  if (!tokenId) return;

  const performedBy = await requireEmployeeId();
  const supabase = await createClient();

  await supabase.from("induction_tokens").update({ status: "revoked" }).eq("id", tokenId);
  await supabase.from("induction_token_history").insert({
    token_id: tokenId,
    action: "revoked",
    performed_by: performedBy,
    note: "Resubmission requested by admin — employee must complete a new invitation.",
  });

  revalidatePath("/inductions");
  revalidatePath("/inductions/submissions");
}
