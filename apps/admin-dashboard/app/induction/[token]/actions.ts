"use server";

import { createServiceRoleClient } from "@macro/shared/supabase/server";
import { hashToken } from "@/lib/inductionToken";
import { generateCertificateNumber, generateCertificatePdfBuffer } from "@/lib/certificate";
import { uploadImageToImageKit } from "@macro/shared/imagekit";

export interface InductionFormState {
  error?: string;
  expired?: boolean;
  success?: boolean;
}

const ACK_KEYS = ["siteRules", "ppe", "emergency", "hazards"] as const;

/**
 * Every action here re-validates the token from scratch against the
 * database — never trusting a status/expiry the client might have rendered
 * a moment ago. This is the actual security boundary (see spec §23/§31):
 * a frontend countdown or cached page state is not authoritative.
 */
async function loadLiveToken(rawToken: string) {
  const supabase = createServiceRoleClient();
  const tokenHash = hashToken(rawToken);
  const { data: token } = await supabase.from("induction_tokens").select("*").eq("token_hash", tokenHash).maybeSingle();
  return { supabase, token };
}

function checkTokenUsable(token: { status: string; expires_at: string } | null): InductionFormState | null {
  if (!token) return { error: "This induction link is invalid." };
  if (token.status === "revoked") return { error: "This induction link has been revoked. Contact your administrator for a new one." };
  if (token.status === "completed") return { error: "This induction has already been submitted." };
  if (new Date() > new Date(token.expires_at)) {
    return { expired: true, error: "Your induction invitation has expired. Please contact your administrator to request a new induction link." };
  }
  return null;
}

export async function saveDraftAction(_prev: InductionFormState, formData: FormData): Promise<InductionFormState> {
  const rawToken = String(formData.get("rawToken") ?? "");
  const { supabase, token } = await loadLiveToken(rawToken);
  const blocked = checkTokenUsable(token);
  if (blocked) return blocked;

  const acknowledgements: Record<string, boolean> = {};
  for (const key of ACK_KEYS) acknowledgements[key] = formData.get(key) === "on";
  const signatureName = String(formData.get("signatureName") ?? "").trim();

  const { data: existing } = await supabase
    .from("induction_submissions")
    .select("id")
    .eq("token_id", token!.id)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("induction_submissions")
      .update({ acknowledgements, signature_name: signatureName || null, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("induction_submissions").insert({
      token_id: token!.id,
      employee_id: token!.employee_id,
      site_id: token!.site_id,
      acknowledgements,
      signature_name: signatureName || null,
      status: "draft",
    });
  }

  await supabase.from("induction_tokens").update({ last_accessed_at: new Date().toISOString() }).eq("id", token!.id);
  return {};
}

export async function submitInductionAction(_prev: InductionFormState, formData: FormData): Promise<InductionFormState> {
  const rawToken = String(formData.get("rawToken") ?? "");
  const { supabase, token } = await loadLiveToken(rawToken);
  const blocked = checkTokenUsable(token);
  if (blocked) return blocked;

  const acknowledgements: Record<string, boolean> = {};
  for (const key of ACK_KEYS) acknowledgements[key] = formData.get(key) === "on";
  const signatureName = String(formData.get("signatureName") ?? "").trim();

  if (!ACK_KEYS.every((k) => acknowledgements[k])) {
    return { error: "Please acknowledge every item before submitting." };
  }
  if (!signatureName) {
    return { error: "Type your full name to sign the induction." };
  }

  const now = new Date();
  const { data: existing } = await supabase
    .from("induction_submissions")
    .select("id")
    .eq("token_id", token!.id)
    .maybeSingle();

  let submissionId = existing?.id as string | undefined;
  if (submissionId) {
    await supabase
      .from("induction_submissions")
      .update({
        acknowledgements,
        signature_name: signatureName,
        status: "pending_approval",
        submitted_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", submissionId);
  } else {
    const { data: created } = await supabase
      .from("induction_submissions")
      .insert({
        token_id: token!.id,
        employee_id: token!.employee_id,
        site_id: token!.site_id,
        acknowledgements,
        signature_name: signatureName,
        status: "pending_approval",
        submitted_at: now.toISOString(),
      })
      .select("id")
      .single();
    submissionId = created?.id;
  }

  if (!submissionId) return { error: "Couldn't save your submission — try again." };

  // Prevent reuse (spec §29): the token can no longer be used to submit
  // another induction once this one goes through.
  await supabase.from("induction_tokens").update({ status: "completed", used_at: now.toISOString() }).eq("id", token!.id);

  // Generate + upload the certificate PDF (best-effort — a failure here
  // still leaves the submission correctly recorded as pending approval).
  const [{ data: employee }, { data: site }] = await Promise.all([
    supabase.from("employees").select("full_name").eq("id", token!.employee_id).maybeSingle(),
    supabase.from("sites").select("name, companies(name)").eq("id", token!.site_id).maybeSingle(),
  ]);
  const certificateNumber = generateCertificateNumber();
  const issuedAt = now;
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + 12); // certificate validity is independent of the invitation link's expiry — 12 months default.

  let fileUrl: string | null = null;
  const pdfBuffer = await generateCertificatePdfBuffer({
    certificateNumber,
    employeeName: employee?.full_name ?? "—",
    siteName: site?.name ?? "—",
    companyName: (site?.companies as { name?: string } | null)?.name ?? "—",
    issuedAt,
    expiresAt,
  });
  if (pdfBuffer) {
    try {
      const file = new File([new Uint8Array(pdfBuffer)], `${certificateNumber}.pdf`, { type: "application/pdf" });
      fileUrl = await uploadImageToImageKit(file, `inductions/certificates`);
    } catch {
      fileUrl = null;
    }
  }

  await supabase.from("induction_certificates").insert({
    submission_id: submissionId,
    employee_id: token!.employee_id,
    site_id: token!.site_id,
    certificate_number: certificateNumber,
    file_url: fileUrl,
    status: "pending",
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  });

  return { success: true };
}
