"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { FieldLabel, PrimaryButton, Select, TextInput } from "@/components/ui";
import { createInductionAction, type CreateInductionResult } from "./actions";

const EXPIRY_OPTIONS = [
  { value: "24h", label: "24 hours" },
  { value: "48h", label: "48 hours" },
  { value: "3d", label: "3 days" },
  { value: "7d", label: "7 days (default)" },
  { value: "14d", label: "14 days" },
  { value: "30d", label: "30 days" },
  { value: "custom", label: "Custom date/time" },
];

function SubmitButton() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Generating…" : "Generate Link"}</PrimaryButton>;
}

export function CreateInductionModal({
  employees,
  sites,
  templates,
  defaultTemplateId,
  onClose,
}: {
  employees: { id: string; full_name: string }[];
  sites: { id: string; name: string; company_id: string }[];
  templates: { id: string; name: string }[];
  defaultTemplateId?: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<CreateInductionResult, FormData>(createInductionAction, {});
  const [expiryOption, setExpiryOption] = useState("7d");
  const [copied, setCopied] = useState(false);

  const link = state.rawToken ? `${window.location.origin}/induction/${state.rawToken}` : null;

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore — the link is still shown/selectable manually
    }
  }

  if (link) {
    return (
      <Modal title="Induction Link Ready" onClose={onClose}>
        <div className="flex flex-col gap-3.5">
          <div className="rounded-lg bg-olive/15 px-3.5 py-3 text-sm font-semibold text-olive-text">
            Invitation created. Send this link to the employee.
          </div>
          <div className="flex gap-2">
            <TextInput readOnly value={link} onFocus={(e) => e.target.select()} className="flex-1" />
            <button type="button" onClick={copyLink} className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-bold text-white">
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <div className="mt-2 flex justify-end">
            <PrimaryButton onClick={onClose}>Done</PrimaryButton>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Create Induction Invitation" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        <div>
          <FieldLabel>Employee</FieldLabel>
          <Select name="employeeId" required defaultValue="">
            <option value="" disabled>Select employee</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Site</FieldLabel>
          <Select name="siteId" required defaultValue="">
            <option value="" disabled>Select site</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Induction Template</FieldLabel>
          <Select name="templateId" required defaultValue={defaultTemplateId ?? templates[0]?.id ?? ""}>
            {templates.length === 0 && <option value="" disabled>No templates yet — create one first</option>}
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Link Expiration</FieldLabel>
          <Select name="expiryOption" value={expiryOption} onChange={(e) => setExpiryOption(e.target.value)}>
            {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        {expiryOption === "custom" && (
          <div>
            <FieldLabel>Custom Expiration Date/Time</FieldLabel>
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
