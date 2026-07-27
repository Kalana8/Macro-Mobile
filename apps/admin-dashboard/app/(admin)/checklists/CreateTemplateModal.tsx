"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { FieldLabel, PrimaryButton, Select, TextInput } from "@/components/ui";
import type { ChecklistTemplate } from "@macro/shared/types";
import { createTemplateAction, type ChecklistFormState } from "./actions";

interface DraftArea {
  mainArea: string;
  note: string;
  subtasks: string[];
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : label}</PrimaryButton>;
}

export function CreateTemplateModal({
  companies,
  template,
  onClose,
}: {
  companies: { id: string; name: string }[];
  template?: ChecklistTemplate;
  onClose: () => void;
}) {
  const isEdit = Boolean(template);
  const [state, formAction] = useActionState<ChecklistFormState, FormData>(createTemplateAction, {});
  const [areas, setAreas] = useState<DraftArea[]>(
    template
      ? template.areas.map((a) => ({ mainArea: a.main_area, note: a.note, subtasks: a.subtasks.map((s) => s.text) }))
      : [{ mainArea: "", note: "", subtasks: [""] }]
  );

  useEffect(() => {
    if (state.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  function updateArea(i: number, patch: Partial<DraftArea>) {
    setAreas((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }
  function updateSubtask(ai: number, si: number, text: string) {
    setAreas((prev) =>
      prev.map((a, idx) => (idx === ai ? { ...a, subtasks: a.subtasks.map((s, sIdx) => (sIdx === si ? text : s)) } : a))
    );
  }

  return (
    <Modal title={isEdit ? "Edit Checklist Template" : "Create Checklist Template"} onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        {isEdit && <input type="hidden" name="templateId" value={template!.id} />}
        <input type="hidden" name="areasJson" value={JSON.stringify(areas)} />
        <div>
          <FieldLabel>Company</FieldLabel>
          <Select name="companyId" defaultValue={template?.company_id ?? companies[0]?.id ?? ""}>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Site</FieldLabel>
          <TextInput name="site" required defaultValue={template?.site} placeholder="Site A" />
        </div>

        {areas.map((area, ai) => (
          <div key={ai} className="rounded-[14px] border border-border bg-bg p-3.5">
            <div className="mb-2.5 flex items-center gap-2">
              <TextInput
                value={area.mainArea}
                onChange={(e) => updateArea(ai, { mainArea: e.target.value })}
                placeholder="Main area, e.g. Room Clean"
                className="flex-1 font-semibold"
              />
              {areas.length > 1 && (
                <button
                  type="button"
                  onClick={() => setAreas((prev) => prev.filter((_, idx) => idx !== ai))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-text-muted"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="mb-1.5 text-[11px] font-semibold text-text-muted">SUB TASKS</div>
            <div className="flex flex-col gap-2">
              {area.subtasks.map((s, si) => (
                <div key={si} className="flex items-center gap-2">
                  <TextInput
                    value={s}
                    onChange={(e) => updateSubtask(ai, si, e.target.value)}
                    placeholder="e.g. Vacuum carpets"
                    className="flex-1"
                  />
                  {area.subtasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => updateArea(ai, { subtasks: area.subtasks.filter((_, idx) => idx !== si) })}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-text-muted"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateArea(ai, { subtasks: [...area.subtasks, ""] })}
                className="w-fit text-[12.5px] font-semibold text-primary"
              >
                + Add sub task
              </button>
            </div>
            <div className="mt-2.5">
              <textarea
                value={area.note}
                onChange={(e) => updateArea(ai, { note: e.target.value })}
                placeholder="Instructions for this main area"
                rows={2}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAreas((prev) => [...prev, { mainArea: "", note: "", subtasks: [""] }])}
          className="w-fit text-sm font-bold text-primary"
        >
          + Add another main area
        </button>

        {state.error && (
          <div className="text-[12.5px] text-error-text">{state.error}</div>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
            Cancel
          </button>
          <SubmitButton label={isEdit ? "Save Changes" : "Create Template"} />
        </div>
      </form>
    </Modal>
  );
}
