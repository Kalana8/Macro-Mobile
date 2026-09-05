import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";
import { Badge, Card, PageHeader } from "@/components/ui";
import { toOne } from "@/lib/embed";
import { formatDate, formatTime } from "@macro/shared/datetime";
import type { InductionCertificate, InductionSubmission, InductionToken, InductionTokenHistory } from "@macro/shared/types";
import { approveSubmissionAction } from "../actions";
import { effectiveStatus } from "../types";
import { RejectButton } from "./RejectButton";

function fullDate(iso: string | null): string {
  if (!iso) return "—";
  return `${formatDate(iso, { day: "2-digit", month: "long", year: "numeric" })}, ${formatTime(iso, { hour: "numeric", minute: "2-digit" })}`;
}

const STATUS_TONE = { active: "info", expiring_soon: "warning", expired: "error", completed: "success", revoked: "neutral" } as const;
const STATUS_LABEL = { active: "Active", expiring_soon: "Expiring Soon", expired: "Expired", completed: "Completed", revoked: "Revoked" } as const;

const ACK_LABELS: Record<string, string> = {
  siteRules: "I have read and understood the site safety rules.",
  ppe: "I understand the PPE requirements for this site.",
  emergency: "I understand the emergency procedures for this site.",
  hazards: "I have been made aware of the known site hazards.",
};

export default async function InductionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: token } = await supabase
    .from("induction_tokens")
    .select("*, employees!induction_tokens_employee_id_fkey(full_name), sites(name, companies(name))")
    .eq("id", id)
    .maybeSingle();

  if (!token) notFound();

  const [{ data: history }, { data: submission }] = await Promise.all([
    supabase.from("induction_token_history").select("*").eq("token_id", id).order("performed_at", { ascending: false }),
    supabase.from("induction_submissions").select("*").eq("token_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const certificate = submission
    ? (await supabase.from("induction_certificates").select("*").eq("submission_id", submission.id).maybeSingle()).data
    : null;

  const employee = toOne(token.employees as { full_name?: string } | { full_name?: string }[] | null);
  const site = toOne(token.sites as { name?: string; companies?: unknown } | { name?: string; companies?: unknown }[] | null);
  const company = toOne(site?.companies as { name?: string } | { name?: string }[] | null | undefined);
  const eStatus = effectiveStatus(token as unknown as InductionToken);
  const sub = submission as InductionSubmission | null;
  const cert = certificate as InductionCertificate | null;

  return (
    <div>
      <PageHeader title={employee?.full_name ?? "—"} subtitle={`Induction invitation for ${site?.name ?? "—"}`} />
      <Link href="/inductions" className="mb-4 inline-block text-sm font-semibold text-primary">
        ← All Inductions
      </Link>

      <div className="flex flex-col gap-4">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold text-text-dark">Invitation Link</div>
            <Badge tone={STATUS_TONE[eStatus]}>{STATUS_LABEL[eStatus]}</Badge>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Company / Site</div>
              <div className="text-sm text-text-dark">{company?.name ?? "—"} · {site?.name ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Link Created</div>
              <div className="text-sm text-text-dark">{fullDate(token.created_at)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Expires</div>
              <div className="text-sm text-text-dark">{fullDate(token.expires_at)}</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Last Accessed</div>
              <div className="text-sm text-text-dark">{fullDate(token.last_accessed_at)}</div>
            </div>
          </div>
        </Card>

        {sub && (
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-bold text-text-dark">Induction Submission</div>
              <Badge tone={sub.status === "approved" ? "success" : sub.status === "rejected" ? "error" : sub.status === "pending_approval" ? "warning" : "neutral"}>
                {sub.status === "pending_approval" ? "Pending Approval" : sub.status[0].toUpperCase() + sub.status.slice(1)}
              </Badge>
            </div>
            <div className="mb-3 text-xs text-text-muted">Submitted {fullDate(sub.submitted_at)}</div>
            <div className="flex flex-col gap-1.5">
              {Object.entries(sub.acknowledgements ?? {}).map(([key, checked]) => (
                <div key={key} className="flex items-center gap-2 text-[13px]">
                  <span className={checked ? "text-olive-text" : "text-text-muted"}>{checked ? "✓" : "○"}</span>
                  <span className={checked ? "text-text-dark" : "text-text-muted"}>{ACK_LABELS[key] ?? key}</span>
                </div>
              ))}
            </div>
            {sub.signature_name && (
              <div className="mt-3 rounded-lg bg-bg px-3.5 py-2.5">
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Signed By</div>
                <div className="text-sm font-semibold italic text-text-dark">{sub.signature_name}</div>
              </div>
            )}
            {sub.review_note && (
              <div className="mt-3 rounded-lg bg-error/10 px-3.5 py-2.5 text-sm text-error">
                <span className="font-bold">Rejection note: </span>{sub.review_note}
              </div>
            )}

            {sub.status === "pending_approval" && (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                <form action={approveSubmissionAction}>
                  <input type="hidden" name="submissionId" value={sub.id} />
                  <button type="submit" className="rounded-[11px] bg-olive-text px-4 py-2.5 text-sm font-bold text-white">
                    Approve
                  </button>
                </form>
                <RejectButton submissionId={sub.id} />
              </div>
            )}
          </Card>
        )}

        {cert && (
          <Card>
            <div className="mb-3 text-sm font-bold text-text-dark">Certificate</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Certificate No.</div>
                <div className="text-sm text-text-dark">{cert.certificate_number}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Status</div>
                <Badge tone={cert.status === "active" ? "success" : cert.status === "expired" ? "error" : cert.status === "revoked" ? "neutral" : "warning"}>
                  {cert.status[0].toUpperCase() + cert.status.slice(1)}
                </Badge>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Issued</div>
                <div className="text-sm text-text-dark">{fullDate(cert.issued_at)}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Certificate Expires</div>
                <div className="text-sm text-text-dark">{fullDate(cert.expires_at)}</div>
              </div>
            </div>
            {cert.file_url && (
              <a href={cert.file_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-primary">
                Download Certificate PDF →
              </a>
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
