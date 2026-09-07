"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { QuestionInput } from "@/components/QuestionInput";
import type { InductionAnswerValue, InductionFormSection } from "@macro/shared/types";
import { saveDraftAction, submitInductionAction, type InductionFormState } from "./actions";
import { InductionIntro } from "./InductionIntro";
import { CertificateScreen } from "./CertificateScreen";

function countdownLabel(msRemaining: number): string {
  if (msRemaining <= 0) return "Expired";
  const totalMinutes = Math.floor(msRemaining / 60_000);
  if (totalMinutes < 60) return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    const mins = totalMinutes % 60;
    return mins > 0 ? `${totalHours} hours ${mins} minutes` : `${totalHours} hours`;
  }
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  return hours > 0 ? `${days} days ${hours} hours` : `${days} days`;
}

function isEmptyAnswer(value: InductionAnswerValue): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

function SubmitButton({ label, pendingLabel, className, onClick }: { label: string; pendingLabel: string; className: string; onClick?: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} onClick={onClick} className={className}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function InductionForm({
  rawToken,
  employeeName,
  siteName,
  companyName,
  expiresAt,
  assignmentTitle,
  assignmentDescription,
  sections,
  initialAnswers,
  initialSignatureName,
}: {
  rawToken: string;
  employeeName: string;
  siteName: string;
  companyName: string;
  expiresAt: string;
  assignmentTitle: string;
  assignmentDescription: string;
  sections: InductionFormSection[];
  initialAnswers: Record<string, InductionAnswerValue>;
  initialSignatureName: string;
}) {
  const [answers, setAnswers] = useState<Record<string, InductionAnswerValue>>(initialAnswers);
  const [signatureName, setSignatureName] = useState(initialSignatureName);
  const [now, setNow] = useState(() => Date.now());
  const [triedSubmit, setTriedSubmit] = useState(false);
  // A draft already in progress (e.g. reopening the link) skips straight to
  // the form — the intro screen is only for a first-time, unstarted visit.
  const [started, setStarted] = useState(() => Object.values(initialAnswers).some((v) => v !== null && v !== undefined && v !== ""));

  const [draftState, draftAction] = useActionState<InductionFormState, FormData>(saveDraftAction, {});
  const [submitState, submitAction] = useActionState<InductionFormState, FormData>(submitInductionAction, {});

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const msRemaining = new Date(expiresAt).getTime() - now;
  // This client-side countdown is only for user awareness (spec §28/§31) —
  // the actual gate is the server re-checking expires_at on every save/submit,
  // so a stale clock or paused tab here can never let a truly expired link
  // through; it would just get the real "expired" error back from the server.
  const urgent = msRemaining < 3600_000;

  function setAnswer(id: string, value: InductionAnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  if (submitState.success && submitState.certificate) {
    return <CertificateScreen employeeName={employeeName} certificate={submitState.certificate} justSubmitted expired={false} />;
  }

  if (submitState.expired || draftState.expired) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-4xl">🔴</div>
        <h1 className="text-xl font-extrabold text-text-dark">Your induction link has expired</h1>
        <p className="text-sm text-text-muted">Your progress may be saved, but you need a new valid invitation link to continue.</p>
      </div>
    );
  }

  if (!started) {
    return (
      <InductionIntro
        assignmentTitle={assignmentTitle}
        assignmentDescription={assignmentDescription}
        sections={sections}
        onStart={() => setStarted(true)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg p-5 pb-28">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Image src="/uploads/footer.webp" alt="Macro Property Services" width={140} height={52} className="h-11 w-auto" />
        <h1 className="mt-1 text-lg font-extrabold text-text-dark">{assignmentTitle}</h1>
        {assignmentDescription && <p className="text-xs text-text-muted">{assignmentDescription}</p>}
      </div>

      <div className={`mb-4 rounded-xl px-3.5 py-2.5 text-center text-xs font-semibold ${urgent ? "bg-error/10 text-error" : "bg-bg text-text-muted"}`}>
        Invitation expires in {countdownLabel(msRemaining)}
      </div>

      {(employeeName || siteName || companyName) && (
        <div className="mb-4 rounded-xl border border-border bg-white p-4">
          <div className="grid grid-cols-2 gap-3 text-xs">
            {employeeName && (
              <div>
                <div className="font-bold uppercase tracking-wide text-text-muted">Employee</div>
                <div className="text-sm text-text-dark">{employeeName}</div>
              </div>
            )}
            {siteName && (
              <div>
                <div className="font-bold uppercase tracking-wide text-text-muted">Site</div>
                <div className="text-sm text-text-dark">{siteName}</div>
              </div>
            )}
            {companyName && (
              <div className="col-span-2">
                <div className="font-bold uppercase tracking-wide text-text-muted">Company</div>
                <div className="text-sm text-text-dark">{companyName}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <form action={draftAction} id="induction-form" encType="multipart/form-data" className="flex flex-col gap-3">
        <input type="hidden" name="rawToken" value={rawToken} />

        {sections.map((section) => (
          <div key={section.id} className="rounded-xl border border-border bg-white p-4">
            <div className="mb-3">
              <div className="text-[15px] font-bold text-text-dark">{section.title}</div>
              {section.description && <div className="mt-0.5 text-xs text-text-muted">{section.description}</div>}
            </div>
            <div className="flex flex-col gap-4">
              {section.questions.map((q) => {
                const invalid = triedSubmit && q.required && isEmptyAnswer(answers[q.id] ?? null);
                return (
                  <div key={q.id}>
                    <label className="mb-1.5 block text-sm font-semibold text-text-dark">
                      {q.title}
                      {q.required && <span className="ml-1 text-error">*</span>}
                    </label>
                    {q.description && <p className="mb-1.5 text-xs text-text-muted">{q.description}</p>}
                    <QuestionInput question={q} value={answers[q.id] ?? null} onChange={(v) => setAnswer(q.id, v)} invalid={invalid} />
                    {invalid && <p className="mt-1 text-[11.5px] text-error">This question is required.</p>}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-border bg-white p-4">
          <label className="text-xs font-bold uppercase tracking-wide text-text-muted">Signature — type your full name to sign</label>
          <input
            type="text"
            name="signatureName"
            value={signatureName}
            onChange={(e) => setSignatureName(e.target.value)}
            placeholder="Full name"
            className="mt-1.5 w-full rounded-lg border border-border px-3 py-2.5 text-sm italic outline-none focus:border-primary"
          />
        </div>

        {(draftState.error && !draftState.expired) && <div className="text-[12.5px] text-error-text">{draftState.error}</div>}
        {(submitState.error && !submitState.expired) && <div className="text-[12.5px] text-error-text">{submitState.error}</div>}

        {/* Fixed position works fine nested inside the form — keeping both
            buttons as actual descendants (rather than cross-referencing via
            a `form` attribute) is what makes useFormStatus() below track
            this form's pending state, and lets Save Draft submit at all. */}
        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-border bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <SubmitButton
            label="Save Draft"
            pendingLabel="Saving…"
            className="flex-1 rounded-xl border border-border py-3 text-sm font-bold text-text-dark"
          />
          <button
            type="submit"
            formAction={submitAction}
            onClick={() => setTriedSubmit(true)}
            className="flex-[2] rounded-xl bg-primary py-3 text-sm font-bold text-white"
          >
            Submit Induction
          </button>
        </div>
      </form>
    </div>
  );
}
