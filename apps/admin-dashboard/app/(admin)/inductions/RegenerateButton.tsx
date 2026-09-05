"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { PrimaryButton, TextInput } from "@/components/ui";
import { regenerateInductionAction, type CreateInductionResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Regenerating…" : "Regenerate Link"}
    </PrimaryButton>
  );
}

/** Revokes the old token and creates a new one — old link → REVOKED, new link → ACTIVE. */
export function RegenerateButton({ tokenId }: { tokenId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<CreateInductionResult, FormData>(regenerateInductionAction, {});
  const [copied, setCopied] = useState(false);

  const link = state.rawToken ? `${window.location.origin}/induction/${state.rawToken}` : null;

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg text-text-dark"
        aria-label="Regenerate link"
        title="Regenerate link"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </button>

      {open && (
        <Modal title="Regenerate Induction Link" onClose={() => setOpen(false)}>
          {link ? (
            <div className="flex flex-col gap-3.5">
              <div className="rounded-lg bg-olive/15 px-3.5 py-3 text-sm font-semibold text-olive-text">
                New link generated — the old link is now revoked and can no longer be used.
              </div>
              <div className="flex gap-2">
                <TextInput readOnly value={link} onFocus={(e) => e.target.select()} className="flex-1" />
                <button type="button" onClick={copyLink} className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-bold text-white">
                  {copied ? "Copied ✓" : "Copy"}
                </button>
              </div>
              <div className="mt-2 flex justify-end">
                <PrimaryButton onClick={() => setOpen(false)}>Done</PrimaryButton>
              </div>
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-3.5">
              <input type="hidden" name="tokenId" value={tokenId} />
              <p className="text-sm text-text-muted">
                This invalidates the current link immediately and creates a brand new one (valid for 7 days). Use this if a link was compromised, expired, or needs replacing.
              </p>
              {state.error && <div className="text-[12.5px] text-error-text">{state.error}</div>}
              <div className="mt-2 flex justify-end gap-2">
                <button type="button" onClick={() => setOpen(false)} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
                  Cancel
                </button>
                <SubmitButton />
              </div>
            </form>
          )}
        </Modal>
      )}
    </>
  );
}
