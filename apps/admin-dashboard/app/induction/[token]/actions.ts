"use server";

import { headers } from "next/headers";
import { createServiceRoleClient } from "@macro/shared/supabase/server";
import { hashToken } from "@/lib/inductionToken";
import { generateCertificateNumber, generateCertificatePdfBuffer } from "@/lib/certificate";
import { scoreAttempt } from "@/lib/assessment";
import { toOne } from "@/lib/embed";
import { uploadImageToImageKit } from "@macro/shared/imagekit";
import type {
  InductionAnswerValue,
  InductionAttempt,
  InductionFormSection,
  InductionQuestion,
  InductionTrainingSlide,
} from "@macro/shared/types";

export interface InductionCertificateInfo {
  certificateNumber: string;
  employeeName: string;
  siteName: string;
  companyName: string;
  assignmentName: string;
  issuedAt: string;
  expiresAt: string;
  fileUrl: string | null;
  scorePercent: number;
  passMarkPercent: number;
  attemptCount: number;
}

export interface InductionFormState {
  error?: string;
  expired?: boolean;
}

export interface AssessmentResult {
  attempt: InductionAttempt;
  passed: boolean;
  maxAttemptsReached: boolean;
  retakeAvailableAt: string | null;
}

export interface AssessmentSubmitState {
  error?: string;
  expired?: boolean;
  result?: AssessmentResult;
  certificate?: InductionCertificateInfo;
}

interface FullTemplate {
  name: string;
  trainingSlides: InductionTrainingSlide[];
  questions: InductionQuestion[];
  passMarkPercent: number;
  maxAttempts: number | null;
  retakeDelayHours: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showCorrectAnswers: boolean;
  certificateEnabled: boolean;
}

/**
 * Every action here re-validates the token from scratch against the
 * database — never trusting a status/expiry the client might have rendered
 * a moment ago. This is the actual security boundary: a frontend countdown
 * or cached page state is not authoritative.
 */
async function loadLiveToken(rawToken: string) {
  const supabase = createServiceRoleClient();
  const tokenHash = hashToken(rawToken);
  const { data: token } = await supabase.from("induction_tokens").select("*").eq("token_hash", tokenHash).maybeSingle();
  return { supabase, token };
}

async function getFullTemplate(supabase: ReturnType<typeof createServiceRoleClient>, templateId: string | null): Promise<FullTemplate> {
  const empty: FullTemplate = {
    name: "Site Induction",
    trainingSlides: [],
    questions: [],
    passMarkPercent: 100,
    maxAttempts: null,
    retakeDelayHours: 0,
    shuffleQuestions: false,
    shuffleOptions: false,
    showCorrectAnswers: true,
    certificateEnabled: true,
  };
  if (!templateId) return empty;
  const { data: t } = await supabase.from("induction_templates").select("*").eq("id", templateId).maybeSingle();
  if (!t) return empty;
  const sections = (t.sections as InductionFormSection[] | null) ?? [];
  return {
    name: t.name ?? empty.name,
    trainingSlides: (t.training_slides as InductionTrainingSlide[] | null) ?? [],
    questions: sections.flatMap((s) => s.questions),
    passMarkPercent: t.pass_mark_percent ?? 100,
    maxAttempts: t.max_attempts ?? null,
    retakeDelayHours: t.retake_delay_hours ?? 0,
    shuffleQuestions: Boolean(t.shuffle_questions),
    shuffleOptions: Boolean(t.shuffle_options),
    showCorrectAnswers: t.show_correct_answers ?? true,
    certificateEnabled: t.certificate_enabled ?? true,
  };
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

/** Fetches the one submission row for this token, creating a blank draft on first touch (training progress, then attempts, all accumulate on this same row). */
async function ensureSubmission(supabase: ReturnType<typeof createServiceRoleClient>, token: { id: string; employee_id: string; site_id: string }) {
  const { data: existing } = await supabase.from("induction_submissions").select("*").eq("token_id", token.id).maybeSingle();
  if (existing) return existing;
  const { data: created } = await supabase
    .from("induction_submissions")
    .insert({ token_id: token.id, employee_id: token.employee_id, site_id: token.site_id, status: "draft" })
    .select("*")
    .single();
  return created;
}

/**
 * Builds the answers map from submitted form data, one entry per question.
 * File/image/video questions upload the new file (if one was chosen) and
 * fall back to whatever was already recorded otherwise — a file `<input>`
 * can't be pre-filled by the browser.
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

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

/** Records that one slide was viewed for at least its minimum time — called as each slide is left, not just at the end, so progress survives closing the tab mid-training. */
export async function saveTrainingProgressAction(rawToken: string, slideId: string, timeSpentSeconds: number): Promise<InductionFormState> {
  const { supabase, token } = await loadLiveToken(rawToken);
  const blocked = checkTokenUsable(token);
  if (blocked) return blocked;

  const submission = await ensureSubmission(supabase, token!);
  if (!submission) return { error: "Couldn't record your progress — try again." };

  const progress = (submission.training_progress as Record<string, { viewed: boolean; timeSpentSeconds: number; completedAt?: string }>) ?? {};
  progress[slideId] = { viewed: true, timeSpentSeconds, completedAt: new Date().toISOString() };

  await supabase.from("induction_submissions").update({ training_progress: progress, updated_at: new Date().toISOString() }).eq("id", submission.id);
  await supabase.from("induction_tokens").update({ last_accessed_at: new Date().toISOString() }).eq("id", token!.id);
  return {};
}

/** Marks training fully complete — the assessment stays locked until this has been called (enforced server-side in submitAssessmentAction too, never trusting the client alone). */
export async function completeTrainingAction(rawToken: string): Promise<InductionFormState> {
  const { supabase, token } = await loadLiveToken(rawToken);
  const blocked = checkTokenUsable(token);
  if (blocked) return blocked;

  const submission = await ensureSubmission(supabase, token!);
  if (!submission) return { error: "Couldn't record training completion — try again." };

  await supabase
    .from("induction_submissions")
    .update({ training_completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", submission.id);
  return {};
}

// ---------------------------------------------------------------------------
// Assessment
// ---------------------------------------------------------------------------

export async function submitAssessmentAction(_prev: AssessmentSubmitState, formData: FormData): Promise<AssessmentSubmitState> {
  const rawToken = String(formData.get("rawToken") ?? "");
  const { supabase, token } = await loadLiveToken(rawToken);
  const blocked = checkTokenUsable(token);
  if (blocked) return blocked;

  const fullTemplate = await getFullTemplate(supabase, token!.template_id);
  if (fullTemplate.questions.length === 0) return { error: "This assignment has no assessment questions configured." };

  const submission = await ensureSubmission(supabase, token!);
  if (!submission) return { error: "Couldn't load your submission — try again." };

  if (fullTemplate.trainingSlides.length > 0 && !submission.training_completed_at) {
    return { error: "Please complete the training before starting the assessment." };
  }

  const priorAttempts = (submission.attempts as InductionAttempt[] | null) ?? [];
  if (priorAttempts.some((a) => a.passed)) {
    return { error: "You have already passed this assessment." };
  }
  if (fullTemplate.maxAttempts !== null && priorAttempts.length >= fullTemplate.maxAttempts) {
    return { error: "You have reached the maximum number of attempts for this assessment. Contact your administrator." };
  }
  if (fullTemplate.retakeDelayHours > 0 && priorAttempts.length > 0) {
    const last = priorAttempts[priorAttempts.length - 1];
    const availableAt = new Date(new Date(last.submittedAt).getTime() + fullTemplate.retakeDelayHours * 3600_000);
    if (new Date() < availableAt) {
      return { error: `You can retake this assessment after ${availableAt.toLocaleString()}.` };
    }
  }

  const existingAnswers = (submission.answers as Record<string, InductionAnswerValue> | null) ?? {};
  const answers = await buildAnswers(formData, fullTemplate.questions, existingAnswers, `inductions/answers/${token!.id}`);

  const missingRequired = fullTemplate.questions.some((q) => q.required && isEmptyAnswer(answers[q.id] ?? null));
  if (missingRequired) return { error: "Please answer every required question before submitting." };

  const now = new Date();
  const startedAtRaw = String(formData.get("startedAt") ?? "");
  const startedAt = startedAtRaw && !Number.isNaN(new Date(startedAtRaw).getTime()) ? startedAtRaw : now.toISOString();

  const graded = scoreAttempt(fullTemplate.questions, answers, fullTemplate.passMarkPercent);
  const attempt: InductionAttempt = {
    attemptNumber: priorAttempts.length + 1,
    startedAt,
    submittedAt: now.toISOString(),
    answers,
    results: graded.results,
    score: graded.score,
    maxScore: graded.maxScore,
    percentage: graded.percentage,
    passed: graded.passed,
  };
  const attempts = [...priorAttempts, attempt];
  const newStatus = graded.passed ? "completed" : "failed";

  await supabase
    .from("induction_submissions")
    .update({ answers, attempts, status: newStatus, submitted_at: now.toISOString(), updated_at: now.toISOString() })
    .eq("id", submission.id);

  if (!graded.passed) {
    const maxAttemptsReached = fullTemplate.maxAttempts !== null && attempts.length >= fullTemplate.maxAttempts;
    const retakeAvailableAt = fullTemplate.retakeDelayHours > 0 ? new Date(now.getTime() + fullTemplate.retakeDelayHours * 3600_000).toISOString() : null;
    return { result: { attempt, passed: false, maxAttemptsReached, retakeAvailableAt } };
  }

  // Passed — the token is now spent (spec: prevent reuse) and, from here on,
  // reopening this link shows the certificate rather than the assessment.
  await supabase.from("induction_tokens").update({ status: "completed", used_at: now.toISOString() }).eq("id", token!.id);

  if (!fullTemplate.certificateEnabled) {
    return { result: { attempt, passed: true, maxAttemptsReached: false, retakeAvailableAt: null } };
  }

  const certificate = await issueCertificate(supabase, token!, fullTemplate.name, attempt);
  return { result: { attempt, passed: true, maxAttemptsReached: false, retakeAvailableAt: null }, certificate };
}

/** Generates the certificate from this exact passing attempt — never independently of it. Best-effort PDF rendering: a hiccup still leaves the submission correctly recorded as passed. */
async function issueCertificate(
  supabase: ReturnType<typeof createServiceRoleClient>,
  token: { id: string; employee_id: string; site_id: string; template_id: string | null },
  assignmentName: string,
  attempt: InductionAttempt
): Promise<InductionCertificateInfo> {
  const { data: submission } = await supabase.from("induction_submissions").select("id").eq("token_id", token.id).maybeSingle();
  const [{ data: employee }, { data: site }, { data: template }] = await Promise.all([
    supabase.from("employees").select("full_name").eq("id", token.employee_id).maybeSingle(),
    supabase.from("sites").select("name, companies(name)").eq("id", token.site_id).maybeSingle(),
    token.template_id ? supabase.from("induction_templates").select("pass_mark_percent").eq("id", token.template_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const company = toOne(site?.companies as { name?: string } | { name?: string }[] | null | undefined);
  const employeeName = employee?.full_name ?? "N/A";
  const siteName = site?.name ?? "N/A";
  const companyName = company?.name ?? "N/A";
  const passMarkPercent = template?.pass_mark_percent ?? 100;

  const certificateNumber = generateCertificateNumber();
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt);
  expiresAt.setMonth(expiresAt.getMonth() + 12);

  const { data: certRow } = await supabase
    .from("induction_certificates")
    .insert({
      submission_id: submission?.id,
      employee_id: token.employee_id,
      site_id: token.site_id,
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
      scorePercent: attempt.percentage,
      passMarkPercent,
      attemptCount: attempt.attemptNumber,
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
    certificateNumber,
    employeeName,
    siteName,
    companyName,
    assignmentName,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    fileUrl,
    scorePercent: attempt.percentage,
    passMarkPercent,
    attemptCount: attempt.attemptNumber,
  };
}
