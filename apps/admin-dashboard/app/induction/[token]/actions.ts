"use server";

import { headers } from "next/headers";
import { createServiceRoleClient } from "@macro/shared/supabase/server";
import { hashToken } from "@/lib/inductionToken";
import { generateCertificateNumber, generateCertificatePdfBuffer } from "@/lib/certificate";
import { toOne } from "@/lib/embed";
import { uploadImageToImageKit } from "@macro/shared/imagekit";
import type { InductionAnswerValue, InductionFormSection, InductionQuestion } from "@macro/shared/types";

export interface InductionCertificateInfo {
  certificateNumber: string;
  employeeName: string;
  siteName: string;
  companyName: string;
  assignmentName: string;
  issuedAt: string;
  expiresAt: string;
  fileUrl: string | null;
}

export interface InductionFormState {
  error?: string;
  expired?: boolean;
  success?: boolean;
  certificate?: InductionCertificateInfo;
}

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

/** The assignment name + every question across every section it's built from — not a fixed list. */
async function getTemplate(
  supabase: ReturnType<typeof createServiceRoleClient>,
  templateId: string | null
): Promise<{ name: string; questions: InductionQuestion[] }> {
  if (!templateId) return { name: "Site Induction", questions: [] };
  const { data: template } = await supabase.from("induction_templates").select("name, sections").eq("id", templateId).maybeSingle();
  const sections = (template?.sections as InductionFormSection[] | null) ?? [];
  return { name: template?.name ?? "Site Induction", questions: sections.flatMap((s) => s.questions) };
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

function isEmptyAnswer(value: InductionAnswerValue): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/**
 * Builds the answers map from submitted form data, one entry per question.
 * File/image/video questions upload the new file (if one was chosen) and
 * fall back to whatever was already saved on a prior draft otherwise — a
 * file `<input>` can't be pre-filled by the browser, so without this a
 * second "Save Draft" with no re-selected file would wipe out an upload
 * that already went through.
 */
async function buildAnswers(
  formData: FormData,
  questions: InductionQuestion[],
  existingAnswers: Record<string, InductionAnswerValue>,
  uploadFolder: string
): Promise<Record<string, InductionAnswerValue>> {
  const answers: Record<string, InductionAnswerValue> = {};
  for (const q of questions) {
    if (q.type === "checkboxes") {
      const values = formData.getAll(q.id).map(String).filter(Boolean);
      answers[q.id] = values;
      continue;
    }
    if (q.type === "file_upload" || q.type === "image_upload" || q.type === "video_upload") {
      const file = formData.get(q.id);
      if (file instanceof File && file.size > 0) {
        try {
          const fileUrl = await uploadImageToImageKit(file, uploadFolder);
          answers[q.id] = { fileUrl, fileName: file.name };
        } catch {
          answers[q.id] = existingAnswers[q.id] ?? null;
        }
      } else {
        answers[q.id] = existingAnswers[q.id] ?? null;
      }
      continue;
    }
    const raw = formData.get(q.id);
    answers[q.id] = raw === null ? null : String(raw).trim() || null;
  }
  return answers;
}

async function currentOrigin(): Promise<string> {
  const hdrs = await headers();
  const host = hdrs.get("host") ?? "localhost:3001";
  const proto = hdrs.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function saveDraftAction(_prev: InductionFormState, formData: FormData): Promise<InductionFormState> {
  const rawToken = String(formData.get("rawToken") ?? "");
  const { supabase, token } = await loadLiveToken(rawToken);
  const blocked = checkTokenUsable(token);
  if (blocked) return blocked;

  const { questions } = await getTemplate(supabase, token!.template_id);
  const { data: existing } = await supabase
    .from("induction_submissions")
    .select("id, answers")
    .eq("token_id", token!.id)
    .maybeSingle();
  const existingAnswers = (existing?.answers as Record<string, InductionAnswerValue> | null) ?? {};

  const answers = await buildAnswers(formData, questions, existingAnswers, `inductions/answers/${token!.id}`);
  const signatureName = String(formData.get("signatureName") ?? "").trim();

  if (existing) {
    await supabase
      .from("induction_submissions")
      .update({ answers, signature_name: signatureName || null, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("induction_submissions").insert({
      token_id: token!.id,
      employee_id: token!.employee_id,
      site_id: token!.site_id,
      answers,
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

  const { name: assignmentName, questions } = await getTemplate(supabase, token!.template_id);
  const { data: existing } = await supabase
    .from("induction_submissions")
    .select("id, answers")
    .eq("token_id", token!.id)
    .maybeSingle();
  const existingAnswers = (existing?.answers as Record<string, InductionAnswerValue> | null) ?? {};

  const answers = await buildAnswers(formData, questions, existingAnswers, `inductions/answers/${token!.id}`);
  const signatureName = String(formData.get("signatureName") ?? "").trim();

  const missingRequired = questions.some((q) => q.required && isEmptyAnswer(answers[q.id] ?? null));
  if (questions.length === 0 || missingRequired) {
    return { error: "Please answer every required question before submitting." };
  }
  if (!signatureName) {
    return { error: "Type your full name to sign the induction." };
  }

  const now = new Date();
  let submissionId = existing?.id as string | undefined;
  if (submissionId) {
    await supabase
      .from("induction_submissions")
      .update({
        answers,
        signature_name: signatureName,
        status: "completed",
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
        answers,
        signature_name: signatureName,
        status: "completed",
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

  // Generate the certificate from this exact submission (never independently
  // of it) — best-effort: a PDF-rendering hiccup still leaves the submission
  // correctly recorded as completed, just without a downloadable file yet.
  const [{ data: employee }, { data: site }] = await Promise.all([
    supabase.from("employees").select("full_name").eq("id", token!.employee_id).maybeSingle(),
    supabase.from("sites").select("name, companies(name)").eq("id", token!.site_id).maybeSingle(),
  ]);
  const company = toOne(site?.companies as { name?: string } | { name?: string }[] | null | undefined);
  const employeeName = employee?.full_name ?? "N/A";
  const siteName = site?.name ?? "N/A";
  const companyName = company?.name ?? "N/A";

  const certificateNumber = generateCertificateNumber();
  const issuedAt = now;
  const expiresAt = new Date(now);
  expiresAt.setMonth(expiresAt.getMonth() + 12); // certificate validity is independent of the invitation link's expiry — 12 months default.

  const { data: certRow } = await supabase
    .from("induction_certificates")
    .insert({
      submission_id: submissionId,
      employee_id: token!.employee_id,
      site_id: token!.site_id,
      certificate_number: certificateNumber,
      status: "active",
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    })
    .select("id")
    .single();

  let fileUrl: string | null = null;
  if (certRow?.id) {
    const origin = await currentOrigin();
    const pdfBuffer = await generateCertificatePdfBuffer({
      certificateNumber,
      employeeName,
      siteName,
      companyName,
      assignmentName,
      issuedAt,
      verifyUrl: `${origin}/certificate/${certRow.id}`,
    });
    if (pdfBuffer) {
      try {
        const file = new File([new Uint8Array(pdfBuffer)], `${certificateNumber}.pdf`, { type: "application/pdf" });
        fileUrl = await uploadImageToImageKit(file, `inductions/certificates`);
        await supabase.from("induction_certificates").update({ file_url: fileUrl }).eq("id", certRow.id);
      } catch {
        fileUrl = null;
      }
    }
  }

  return {
    success: true,
    certificate: {
      certificateNumber,
      employeeName,
      siteName,
      companyName,
      assignmentName,
      issuedAt: issuedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      fileUrl,
    },
  };
}
