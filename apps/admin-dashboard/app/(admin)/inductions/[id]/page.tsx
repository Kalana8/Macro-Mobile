import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";
import { Badge, Card, PageHeader } from "@/components/ui";
import { toOne } from "@/lib/embed";
import { formatDate, formatTime } from "@macro/shared/datetime";
import type {
  InductionAnswerValue,
  InductionAttempt,
  InductionCertificate,
  InductionFormSection,
  InductionSubmission,
  InductionSubmissionStatus,
  InductionToken,
  InductionTokenHistory,
  InductionTrainingSlide,
} from "@macro/shared/types";
import { approveSubmissionAction, markSubmissionExpiredAction, requestResubmissionAction } from "../actions";
import { effectiveStatus } from "../types";
import { RejectButton } from "./RejectButton";

function fullDate(iso: string | null): string {
  if (!iso) return "—";
  return `${formatDate(iso, { day: "2-digit", month: "long", year: "numeric" })}, ${formatTime(iso, { hour: "numeric", minute: "2-digit" })}`;
}

function AnswerValue({ value }: { value: InductionAnswerValue }) {
  if (value === null || value === undefined || (Array.isArray(value) && value.length === 0) || value === "") {
    return <span className="text-text-muted">No answer</span>;
  }
  if (Array.isArray(value)) {
    return <span className="text-text-dark">{value.join(", ")}</span>;
  }
  if (typeof value === "object" && "fileUrl" in value) {
    return value.fileUrl ? (
      <a href={value.fileUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">
        {value.fileName || "View file"}
      </a>
    ) : (
      <span className="text-text-muted">{value.fileName} (not uploaded)</span>
    );
  }
  return <span className="text-text-dark">{String(value)}</span>;
}

const STATUS_TONE = { active: "info", expiring_soon: "warning", expired: "error", completed: "success", revoked: "neutral" } as const;
const STATUS_LABEL = { active: "Active", expiring_soon: "Expiring Soon", expired: "Expired", completed: "Completed", revoked: "Revoked" } as const;

const SUB_STATUS_TONE: Record<InductionSubmissionStatus, "info" | "success" | "warning" | "error" | "neutral"> = {
  draft: "neutral",
  completed: "success",
  failed: "error",
  pending_approval: "warning",
  approved: "success",
  rejected: "error",
  expired: "error",
};
const SUB_STATUS_LABEL: Record<InductionSubmissionStatus, string> = {
  draft: "Draft",
  completed: "Passed",
  failed: "Failed",
  pending_approval: "Pending Approval",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};

export default async function InductionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: token } = await supabase
    .from("induction_tokens")
    .select("*, employees!induction_tokens_employee_id_fkey(full_name, job_role, username), sites(name, companies(name))")
    .eq("id", id)
    .maybeSingle();

  if (!token) notFound();

  const [{ data: history }, { data: submission }] = await Promise.all([
    supabase.from("induction_token_history").select("*").eq("token_id", id).order("performed_at", { ascending: false }),
    supabase.from("induction_submissions").select("*").eq("token_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const [{ data: certificate }, { data: template }] = await Promise.all([
    submission
      ? supabase.from("induction_certificates").select("*").eq("submission_id", submission.id).maybeSingle()
      : Promise.resolve({ data: null }),
    token.template_id ? supabase.from("induction_templates").select("*").eq("id", token.template_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const questions = ((template?.sections as InductionFormSection[] | null) ?? []).flatMap((s) => s.questions);
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const trainingSlides = (template?.training_slides as InductionTrainingSlide[] | null) ?? [];

  const employee = toOne(token.employees as { full_name?: string; job_role?: string; username?: string } | { full_name?: string; job_role?: string; username?: string }[] | null);
  const site = toOne(token.sites as { name?: string; companies?: unknown } | { name?: string; companies?: unknown }[] | null);
  const company = toOne(site?.companies as { name?: string } | { name?: string }[] | null | undefined);
  const eStatus = effectiveStatus(token as unknown as InductionToken);
  const sub = submission as InductionSubmission | null;
  const cert = certificate as InductionCertificate | null;
  const certExpired = cert ? new Date() > new Date(cert.expires_at) || cert.status === "expired" : false;

  const canReview = sub && (sub.status === "completed" || sub.status === "failed" || sub.status === "pending_approval");

  const attempts: InductionAttempt[] = sub?.attempts ?? [];
  const latestAttempt = attempts[attempts.length - 1] ?? null;
  const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a) => a.percentage)) : null;
  const trainingProgress = sub?.training_progress ?? {};
  const slidesViewed = trainingSlides.filter((s) => trainingProgress[s.id]?.viewed).length;
  const trainingStatus: "not_started" | "in_progress" | "completed" = sub?.training_completed_at
    ? "completed"
    : slidesViewed > 0
      ? "in_progress"
      : "not_started";

  return (
    <div>
      <PageHeader title={employee?.full_name ?? "—"} subtitle={`${template?.name ?? "Site Induction"} — ${site?.name ?? "—"}`} />
      <Link href="/inductions" className="mb-4 inline-block text-sm font-semibold text-primary">
        ← All Inductions
      </Link>

      <div className="flex flex-col gap-4">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold text-text-dark">Employee & Invitation</div>
            <Badge tone={STATUS_TONE[eStatus]}>{STATUS_LABEL[eStatus]}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Position</div>
              <div className="text-sm text-text-dark">{employee?.job_role || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Email</div>
              <div className="text-sm text-text-dark">{employee?.username || "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Company / Site</div>
              <div className="text-sm text-text-dark">{company?.name ?? "—"} · {site?.name ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Link Expires</div>
              <div className="text-sm text-text-dark">{fullDate(token.expires_at)}</div>
            </div>
          </div>
        </Card>

        {trainingSlides.length > 0 && (
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-bold text-text-dark">Training</div>
              <Badge tone={trainingStatus === "completed" ? "success" : trainingStatus === "in_progress" ? "warning" : "neutral"}>
                {trainingStatus === "completed" ? "Completed" : trainingStatus === "in_progress" ? "In Progress" : "Not Started"}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Slides Completed</div>
                <div className="text-sm text-text-dark">
                  {slidesViewed} / {trainingSlides.length}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Training Completed</div>
                <div className="text-sm text-text-dark">{sub?.training_completed_at ? fullDate(sub.training_completed_at) : "—"}</div>
              </div>
            </div>
          </Card>
        )}

        {sub && (
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-bold text-text-dark">Assessment</div>
              <Badge tone={SUB_STATUS_TONE[sub.status]}>{SUB_STATUS_LABEL[sub.status]}</Badge>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Best Score</div>
                <div className="text-sm text-text-dark">{bestScore !== null ? `${bestScore}%` : "—"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Latest Score</div>
                <div className="text-sm text-text-dark">{latestAttempt ? `${latestAttempt.percentage}%` : "—"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Pass Mark</div>
                <div className="text-sm text-text-dark">{template?.pass_mark_percent ?? 100}%</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Attempts</div>
                <div className="text-sm text-text-dark">{attempts.length}</div>
              </div>
            </div>

            {attempts.length > 0 && (
              <div className="mb-3 rounded-lg bg-bg px-3.5 py-2.5">
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">Attempt History</div>
                <div className="flex flex-col gap-1">
                  {attempts.map((a) => (
                    <div key={a.attemptNumber} className="flex items-center justify-between text-[12.5px]">
                      <span className="text-text-dark">
                        Attempt {a.attemptNumber} — {fullDate(a.submittedAt)}
                      </span>
                      <span className={a.passed ? "font-bold text-olive-text" : "text-error"}>
                        {a.percentage}% — {a.passed ? "Passed" : "Failed"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {latestAttempt && (
              <div className="flex flex-col gap-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-text-muted">Submitted Answers (Attempt {latestAttempt.attemptNumber})</div>
                {Object.entries(latestAttempt.answers ?? sub.answers ?? {}).map(([key, value]) => {
                  const question = questionById.get(key);
                  const result = latestAttempt.results.find((r) => r.questionId === key);
                  return (
                    <div key={key} className="rounded-lg bg-bg px-3.5 py-2.5">
                      <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-text-dark">
                        {result?.correct === true && <span className="text-olive-text">✓</span>}
                        {result?.correct === false && <span className="text-error">✗</span>}
                        <span className="text-text-muted">Question:</span> {question?.title ?? key}
                      </div>
                      <div className="mt-1 text-sm">
                        <span className="font-semibold text-text-muted">Answer: </span>
                        <AnswerValue value={value} />
                      </div>
                      {result?.correct === false && question?.correctAnswers && question.correctAnswers.length > 0 && (
                        <div className="mt-1 text-xs font-semibold text-olive-text">Correct answer: {question.correctAnswers.join(", ")}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {sub.review_note && (
              <div className="mt-3 rounded-lg bg-error/10 px-3.5 py-2.5 text-sm text-error">
                <span className="font-bold">Rejection note: </span>{sub.review_note}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
              {canReview && (
                <>
                  <form action={approveSubmissionAction}>
                    <input type="hidden" name="submissionId" value={sub.id} />
                    <button type="submit" className="rounded-[11px] bg-olive-text px-4 py-2.5 text-sm font-bold text-white">
                      Approve
                    </button>
                  </form>
                  <RejectButton submissionId={sub.id} />
                </>
              )}
              {sub.status !== "expired" && (
                <form action={markSubmissionExpiredAction}>
                  <input type="hidden" name="submissionId" value={sub.id} />
                  <button type="submit" className="rounded-[11px] border border-border px-4 py-2.5 text-sm font-bold text-text-dark">
                    Mark as Expired
                  </button>
                </form>
              )}
              <form action={requestResubmissionAction}>
                <input type="hidden" name="tokenId" value={token.id} />
                <button type="submit" className="rounded-[11px] border border-border px-4 py-2.5 text-sm font-bold text-text-dark">
                  Request New Submission
                </button>
              </form>
            </div>
          </Card>
        )}

        {cert && (
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-bold text-text-dark">Certificate</div>
              <Badge tone={certExpired ? "error" : cert.status === "revoked" ? "neutral" : cert.status === "active" ? "success" : "warning"}>
                {certExpired ? "Expired" : cert.status[0].toUpperCase() + cert.status.slice(1)}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Certificate No.</div>
                <div className="text-sm text-text-dark">{cert.certificate_number}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Induction</div>
                <div className="text-sm text-text-dark">{template?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Completed</div>
                <div className="text-sm text-text-dark">{fullDate(cert.issued_at)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Certificate Expires</div>
                <div className="text-sm text-text-dark">{fullDate(cert.expires_at)}</div>
              </div>
            </div>
            {cert.file_url && (
              <div className="mt-3 flex flex-wrap gap-3">
                <a href={cert.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary">
                  View Certificate →
                </a>
                <a href={cert.file_url} download={`${cert.certificate_number}.pdf`} className="text-sm font-semibold text-primary">
                  Download Certificate →
                </a>
              </div>
            )}
          </Card>
        )}

        <Card>
          <div className="mb-3 text-sm font-bold text-text-dark">History</div>
          {(history ?? []).length === 0 ? (
            <div className="text-xs text-text-muted">No history yet.</div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {(history as InductionTokenHistory[]).map((h) => (
                <div key={h.id} className="flex items-start justify-between gap-3 rounded-lg bg-bg px-3.5 py-2.5 text-xs">
                  <div>
                    <div className="font-semibold text-text-dark">{h.action[0].toUpperCase() + h.action.slice(1)}</div>
                    {h.new_expires_at && <div className="text-text-muted">New expiration: {fullDate(h.new_expires_at)}</div>}
                    {h.note && <div className="text-text-muted">{h.note}</div>}
                  </div>
                  <div className="shrink-0 text-text-muted">{fullDate(h.performed_at)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
