"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { FieldLabel, PrimaryButton, Select, TextArea, TextInput } from "@/components/ui";
import { INDUCTION_TYPE_LABEL, type InductionType } from "@macro/shared/types";
import { createTemplateAction, type TemplateFormState } from "./actions";

const INDUCTION_TYPES = Object.keys(INDUCTION_TYPE_LABEL) as InductionType[];

function SubmitButton() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Creating…" : "Create Template"}</PrimaryButton>;
}

export function NewTemplateModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [state, formAction] = useActionState<TemplateFormState, FormData>(createTemplateAction, {});
  const [inductionType, setInductionType] = useState<InductionType>("whs");
  const [isMandatory, setIsMandatory] = useState(true);

  useEffect(() => {
    if (state.success && state.id) router.push(`/inductions/templates/${state.id}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.id]);

  return (
    <Modal title="New Assignment" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        <div>
          <FieldLabel>Name</FieldLabel>
          <TextInput name="name" required autoFocus placeholder="e.g. Warehouse Site Induction" />
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div>
            <FieldLabel>Induction Type</FieldLabel>
            <Select
              name="inductionType"
              value={inductionType}
              onChange={(e) => {
                const next = e.target.value as InductionType;
                setInductionType(next);
                setIsMandatory(next === "whs");
              }}
            >
              {INDUCTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INDUCTION_TYPE_LABEL[t]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel>Category</FieldLabel>
            <TextInput name="category" placeholder="e.g. General Induction, WHS" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold text-text-dark">
          <input type="checkbox" name="isMandatory" checked={isMandatory} onChange={(e) => setIsMandatory(e.target.checked)} className="h-4 w-4" />
          Mandatory — employees must complete this before starting work
        </label>
        <div>
          <FieldLabel>Description / Instructions</FieldLabel>
          <TextArea name="description" rows={3} placeholder="Optional — shown on the assignment card" />
        </div>
        <p className="text-xs text-text-muted">Starts as a Draft with one pre-filled section, ready to edit — you can add, remove, or reorder anything.</p>

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
