"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { saveDraftAction, submitInductionAction, type InductionFormState } from "./actions";

const ACK_ITEMS = [
  { key: "siteRules", label: "I have read and understood the site safety rules." },
  { key: "ppe", label: "I understand the PPE (Personal Protective Equipment) requirements for this site." },
  { key: "emergency", label: "I understand the emergency procedures and evacuation points for this site." },
  { key: "hazards", label: "I have been made aware of the known hazards present on this site." },
] as const;

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

function SubmitButton({ label, pendingLabel, className }: { label: string; pendingLabel: string; className: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
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
  initialAcknowledgements,
  initialSignatureName,
}: {
  rawToken: string;
  employeeName: string;
  siteName: string;
  companyName: string;
  expiresAt: string;
  initialAcknowledgements: Record<string, boolean>;
  initialSignatureName: string;
}) {
  const [acks, setAcks] = useState<Record<string, boolean>>(initialAcknowledgements);
  const [signatureName, setSignatureName] = useState(initialSignatureName);
  const [now, setNow] = useState(() => Date.now());

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

  if (submitState.success) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <Image src="/uploads/footer.webp" alt="Macro Property Services" width={140} height={52} className="h-11 w-auto" />
        <div className="text-4xl">✅</div>
        <h1 className="text-xl font-extrabold text-text-dark">Induction Submitted</h1>
        <p className="text-sm text-text-muted">
          Thank you, {employeeName}. Your site induction has been submitted and is now awaiting administrator approval. You&apos;ll be notified once it&apos;s approved.
        </p>
      </div>
    );
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

  return (
    <div className="mx-auto max-w-lg p-5 pb-28">
      <div className="flex flex-col items-center gap-2 py-4 text-center">
        <Image src="/uploads/footer.webp" alt="Macro Property Services" width={140} height={52} className="h-11 w-auto" />
        <h1 className="mt-1 text-lg font-extrabold text-text-dark">Site Safety Induction</h1>
      </div>

      <div className={`mb-4 rounded-xl px-3.5 py-2.5 text-center text-xs font-semibold ${urgent ? "bg-error/10 text-error" : "bg-bg text-text-muted"}`}>
        Invitation expires in {countdownLabel(msRemaining)}
      </div>

      <div className="mb-4 rounded-xl border border-border bg-white p-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="font-bold uppercase tracking-wide text-text-muted">Employee</div>
            <div className="text-sm text-text-dark">{employeeName}</div>
          </div>
          <div>
            <div className="font-bold uppercase tracking-wide text-text-muted">Site</div>
            <div className="text-sm text-text-dark">{siteName}</div>
          </div>
          <div className="col-span-2">
            <div className="font-bold uppercase tracking-wide text-text-muted">Company</div>
            <div className="text-sm text-text-dark">{companyName}</div>
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-white p-4 text-sm leading-relaxed text-text-dark">
        <p>
          Welcome to {siteName}. Before you begin work at this site, please read and acknowledge the following site
          safety information. This induction covers the site&apos;s safety rules, required PPE, emergency procedures,
          and known hazards.
        </p>
        <p className="text-text-muted">
          Please read each item carefully and check the box to confirm you understand it. You must acknowledge every
          item before you can submit this induction.
        </p>
      </div>

      <form action={draftAction} id="induction-form" className="flex flex-col gap-3">
        <input type="hidden" name="rawToken" value={rawToken} />

        <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-white p-4">
          {ACK_ITEMS.map((item) => (
            <label key={item.key} className="flex items-start gap-2.5 text-sm text-text-dark">
              <input
                type="checkbox"
                name={item.key}
                checked={Boolean(acks[item.key])}
                onChange={(e) => setAcks((prev) => ({ ...prev, [item.key]: e.target.checked }))}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>

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
          <button type="submit" formAction={submitAction} className="flex-[2] rounded-xl bg-primary py-3 text-sm font-bold text-white">
            Submit Induction
          </button>
        </div>
      </form>
    </div>
  );
}
