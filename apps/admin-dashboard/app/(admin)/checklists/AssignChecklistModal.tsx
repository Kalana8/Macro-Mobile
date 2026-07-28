"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { CheckboxSquare, FieldLabel, PrimaryButton, Select, TextArea } from "@/components/ui";
import type { ChecklistTemplate } from "@macro/shared/types";
import { createAssignmentAction, type ChecklistFormState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Assigning…" : "Assign"}</PrimaryButton>;
}

export function AssignChecklistModal({
  companies,
  templates,
  employees,
  onClose,
}: {
  companies: { id: string; name: string }[];
  templates: ChecklistTemplate[];
  employees: { id: string; full_name: string; companyIds: string[] }[];
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ChecklistFormState, FormData>(createAssignmentAction, {});
  // Two rows can share a company name (a known data quirk) — collapse to
  // one entry per name so the picker doesn't show apparent duplicates.
  const uniqueCompanies = useMemo(() => {
    const seen = new Set<string>();
    return companies.filter((c) => {
      const key = c.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [companies]);
  const [companyId, setCompanyId] = useState(uniqueCompanies[0]?.id ?? "");
  const [templateId, setTemplateId] = useState("");
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);

  const companyTemplates = useMemo(() => templates.filter((t) => t.company_id === companyId), [templates, companyId]);
  const selectedTemplate = companyTemplates.find((t) => t.id === templateId) ?? companyTemplates[0];
  const companyEmployees = useMemo(() => employees.filter((e) => e.companyIds.includes(companyId)), [employees, companyId]);

  useEffect(() => {
    if (state.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  function toggleEmployee(id: string) {
    setSelectedEmployees((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Modal title="Assign Checklist" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        <input type="hidden" name="templateId" value={selectedTemplate?.id ?? ""} />
        {selectedEmployees.map((id) => <input key={id} type="hidden" name="employeeIds" value={id} />)}

        <p className="-mt-1 text-[12.5px] text-text-muted">
          No date to pick — the checklist is sent automatically to each employee on the company&apos;s visit days,
          at its visit time (set on the company itself).
        </p>

        <div>
          <FieldLabel>Company</FieldLabel>
          <Select name="companyId" value={companyId} onChange={(e) => { setCompanyId(e.target.value); setTemplateId(""); }}>
            {uniqueCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Site (from template)</FieldLabel>
          <Select value={selectedTemplate?.site ?? ""} onChange={(e) => setTemplateId(companyTemplates.find((t) => t.site === e.target.value)?.id ?? "")}>
            {companyTemplates.length === 0 && <option value="">No templates for this company</option>}
            {companyTemplates.map((t) => <option key={t.id} value={t.site}>{t.site}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Assign to Employee(s)</FieldLabel>
          <div className="max-h-36 overflow-y-auto rounded-xl border border-border p-2">
            {companyEmployees.length === 0 ? (
              <div className="px-2 py-1.5 text-sm text-text-muted">No employees in this company.</div>
            ) : (
              companyEmployees.map((e) => (
                <button
                  type="button"
                  key={e.id}
                  onClick={() => toggleEmployee(e.id)}
                  className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-[7px] text-left text-[13.5px] text-text-dark"
                >
                  <CheckboxSquare checked={selectedEmployees.includes(e.id)} />
                  {e.full_name}
                </button>
              ))
            )}
          </div>
        </div>

        {selectedTemplate && selectedTemplate.areas.length > 0 && (
          <div className="rounded-xl bg-bg px-3.5 py-3">
            <div className="mb-2 text-[11px] font-bold text-text-muted">CHECKLIST DETAILS</div>
            {selectedTemplate.areas.map((area, i) => (
              <div key={i} className="mb-2.5 last:mb-0">
                <div className="mb-1 text-[13px] font-bold text-text-dark">{area.main_area}</div>
                {area.subtasks.map((s) => (
                  <div key={s.id} className="pl-2 text-[12.5px] text-text-muted">• {s.text}</div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div>
          <FieldLabel>Additional Note</FieldLabel>
          <TextArea name="adminNote" rows={3} placeholder="Any instructions for the employee" />
        </div>

        {state.error && (
          <div className="text-[12.5px] text-error-text">{state.error}</div>
        )}

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
