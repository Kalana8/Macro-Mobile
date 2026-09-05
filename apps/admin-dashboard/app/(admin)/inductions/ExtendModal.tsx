"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { FieldLabel, PrimaryButton, Select, TextInput } from "@/components/ui";
import { formatDate, formatTime } from "@macro/shared/datetime";
import { extendInductionAction, type ActionResult } from "./actions";

const EXTEND_OPTIONS = [
  { value: "24h", label: "+24 hours" },
  { value: "3d", label: "+3 days" },
  { value: "7d", label: "+7 days" },
  { value: "30d", label: "+30 days" },
  { value: "custom", label: "Custom date/time" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Extending…" : "Extend Link"}</PrimaryButton>;
}

function fullDate(iso: string): string {
  return `${formatDate(iso, { day: "2-digit", month: "long", year: "numeric" })}, ${formatTime(iso, { hour: "numeric", minute: "2-digit" })}`;
}

export function ExtendModal({
  tokenId,
  currentExpiresAt,
  onClose,
}: {
  tokenId: string;
  currentExpiresAt: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(extendInductionAction, {});
  const [extendOption, setExtendOption] = useState("7d");

  useEffect(() => {
    if (state.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Modal title="Extend Induction Link" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        <input type="hidden" name="tokenId" value={tokenId} />
        <div className="rounded-lg bg-bg px-3.5 py-3 text-xs">
          <div className="font-bold uppercase tracking-wide text-text-muted">Current Expiration</div>
          <div className="mt-0.5 text-sm font-semibold text-text-dark">{fullDate(currentExpiresAt)}</div>
        </div>
        <div>
          <FieldLabel>Extend By</FieldLabel>
          <Select name="extendOption" value={extendOption} onChange={(e) => setExtendOption(e.target.value)}>
            {EXTEND_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        {extendOption === "custom" && (
          <div>
            <FieldLabel>New Expiration Date/Time</FieldLabel>
            <TextInput type="datetime-local" name="customExpiresAt" required />
          </div>
        )}

        {state.error && <div className="text-[12.5px] text-error-text">{state.error}</div>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
            Cancel
          </button>
          <SubmitButton />
        </div>
      </form>
    </Modal>
  );
}
