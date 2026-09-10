import type { Metadata } from "next";
import Image from "next/image";
import { createServiceRoleClient } from "@macro/shared/supabase/server";
import { formatDate, formatTime } from "@macro/shared/datetime";
import { hashToken } from "@/lib/inductionToken";
import { toOne } from "@/lib/embed";
import type { InductionAttempt, InductionFormSection, InductionTrainingSlide } from "@macro/shared/types";
import { InductionForm } from "./InductionForm";
import { CertificateScreen } from "./CertificateScreen";
import type { InductionCertificateInfo } from "./actions";

export const metadata: Metadata = {
  title: "Site Induction",
  robots: { index: false, follow: false },
};

function ExpiredPage({ siteName, companyName, expiresAt, hasDraft }: { siteName: string | null; companyName: string | null; expiresAt: string | null; hasDraft: boolean }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Image src="/uploads/footer.webp" alt="Macro Property Services" width={140} height={52} className="h-11 w-auto" />
      <div className="text-4xl">🔴</div>
      <h1 className="text-xl font-extrabold text-text-dark">Induction Link Expired</h1>
      <p className="text-sm text-text-muted">
        Your induction invitation has expired. Please contact your administrator to request a new induction link.
      </p>
      {hasDraft && (
        <div className="rounded-xl border border-orange/40 bg-orange/10 px-4 py-3 text-sm text-orange">
          Your progress may be saved, but you need a new valid invitation link to continue. Your induction has not been marked as completed.
        </div>
      )}
      {(siteName || companyName) && (
        <div className="mt-2 rounded-xl border border-border bg-bg px-4 py-3 text-left text-xs text-text-muted">
          {siteName && <div><span className="font-semibold text-text-dark">Site:</span> {siteName}</div>}
          {companyName && <div><span className="font-semibold text-text-dark">Company:</span> {companyName}</div>}
          {expiresAt && (
            <div>
              <span className="font-semibold text-text-dark">Expired:</span>{" "}
              {formatDate(expiresAt, { day: "2-digit", month: "long", year: "numeric" })}, {formatTime(expiresAt, { hour: "numeric", minute: "2-digit" })}
            </div>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-text-muted">Contact your site administrator to request a new invitation link.</p>
    </div>
  );
}

function MessagePage({ emoji, title, message }: { emoji: string; title: string; message: string }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <Image src="/uploads/footer.webp" alt="Macro Property Services" width={140} height={52} className="h-11 w-auto" />
      <div className="text-4xl">{emoji}</div>
      <h1 className="text-xl font-extrabold text-text-dark">{title}</h1>
      <p className="text-sm text-text-muted">{message}</p>
    </div>
  );
}

export default async function InductionLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: rawToken } = await params;
  const supabase = createServiceRoleClient();
  const tokenHash = hashToken(rawToken);

  const { data: token } = await supabase
    .from("induction_tokens")
    .select("*, employees!induction_tokens_employee_id_fkey(full_name), sites(name, allowed_radius, companies(name))")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!token) {
    return <MessagePage emoji="⚠️" title="Invalid Link" message="This induction link is invalid or no longer available." />;
  }

  // Every visit re-checks and records access — never rely on a page that
  // was rendered valid a while ago; the same check runs again on submit.
  await supabase.from("induction_tokens").update({ last_accessed_at: new Date().toISOString() }).eq("id", token.id);

  const employee = toOne(token.employees as { full_name?: string } | { full_name?: string }[] | null);
  const site = toOne(token.sites as { name?: string; companies?: unknown } | { name?: string; companies?: unknown }[] | null);
  const company = toOne(site?.companies as { name?: string } | { name?: string }[] | null | undefined);
  const siteName = site?.name ?? null;
  const companyName = company?.name ?? null;

  if (token.status === "revoked") {
    return (
      <MessagePage
        emoji="⚠️"
        title="Link Revoked"
        message="This induction link has been revoked. Please contact your administrator for a new invitation."
      />
    );
  }

  if (token.status === "completed") {
    const { data: submission } = await supabase
      .from("induction_submissions")
      .select("id, attempts")
      .eq("token_id", token.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const [{ data: certificate }, { data: template }] = await Promise.all([
      submission
        ? supabase.from("induction_certificates").select("*").eq("submission_id", submission.id).maybeSingle()
        : Promise.resolve({ data: null }),
      token.template_id ? supabase.from("induction_templates").select("name, pass_mark_percent").eq("id", token.template_id).maybeSingle() : Promise.resolve({ data: null }),
    ]);

    if (certificate) {
      const attempts = (submission?.attempts as InductionAttempt[] | null) ?? [];
      const passedAttempt = [...attempts].reverse().find((a) => a.passed) ?? null;
      const info: InductionCertificateInfo = {
        certificateNumber: certificate.certificate_number,
        employeeName: employee?.full_name ?? "N/A",
        siteName: siteName ?? "N/A",
        companyName: companyName ?? "N/A",
        assignmentName: template?.name ?? "Site Induction",
        issuedAt: certificate.issued_at,
        expiresAt: certificate.expires_at,
        fileUrl: certificate.file_url,
        scorePercent: passedAttempt?.percentage ?? 100,
        passMarkPercent: template?.pass_mark_percent ?? 100,
        attemptCount: passedAttempt?.attemptNumber ?? attempts.length,
      };
      const expired = new Date() > new Date(certificate.expires_at) || certificate.status === "expired";
      return <CertificateScreen employeeName={info.employeeName} certificate={info} justSubmitted={false} expired={expired} />;
    }

    return (
      <MessagePage
        emoji="✅"
        title="Induction Already Completed"
        message="This induction has already been submitted and can't be used again. Contact your administrator if you need access to your certificate."
      />
    );
  }

  if (new Date() > new Date(token.expires_at)) {
    const { data: draft } = await supabase
      .from("induction_submissions")
      .select("id")
      .eq("token_id", token.id)
      .maybeSingle();
    return <ExpiredPage siteName={siteName} companyName={companyName} expiresAt={token.expires_at} hasDraft={Boolean(draft)} />;
  }

  const [{ data: submission }, { data: template }] = await Promise.all([
    supabase.from("induction_submissions").select("*").eq("token_id", token.id).maybeSingle(),
    token.template_id ? supabase.from("induction_templates").select("*").eq("id", token.template_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const sections = (template?.sections as InductionFormSection[] | null) ?? [];

  if (sections.length === 0) {
    return (
      <MessagePage
        emoji="⚠️"
        title="Induction Not Configured"
        message="This invitation isn't linked to a valid induction assignment. Please contact your administrator."
      />
    );
  }

  return (
    <InductionForm
      rawToken={rawToken}
      employeeName={employee?.full_name ?? ""}
      siteName={siteName ?? ""}
      companyName={companyName ?? ""}
      assignmentTitle={template?.name ?? "Site Safety Induction"}
      assignmentDescription={template?.description ?? ""}
      sections={sections}
      trainingSlides={(template?.training_slides as InductionTrainingSlide[] | null) ?? []}
      passMarkPercent={template?.pass_mark_percent ?? 100}
      maxAttempts={template?.max_attempts ?? null}
      retakeDelayHours={template?.retake_delay_hours ?? 0}
      shuffleQuestions={Boolean(template?.shuffle_questions)}
      shuffleOptions={Boolean(template?.shuffle_options)}
      showCorrectAnswers={template?.show_correct_answers ?? true}
      initialTrainingProgress={
        (submission?.training_progress as Record<string, { viewed: boolean; timeSpentSeconds: number }> | null) ?? {}
      }
      initialTrainingCompletedAt={submission?.training_completed_at ?? null}
      initialAttempts={(submission?.attempts as InductionAttempt[] | null) ?? []}
    />
  );
}
