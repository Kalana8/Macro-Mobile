"use client";

import { useState } from "react";
import { IconChip, PlusIcon, PrimaryButton } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import type { ChecklistTemplate } from "@macro/shared/types";
import { deleteTemplateAction } from "../../checklists/actions";
import { CreateTemplateModal } from "../../checklists/CreateTemplateModal";
import { TemplateDetailModal } from "../../checklists/TemplateDetailModal";
import { AssignChecklistModal } from "../../checklists/AssignChecklistModal";

export function CompanyChecklists({
  companyId,
  companyName,
  templates,
  sites,
  employees,
}: {
  companyId: string;
  companyName: string;
  templates: ChecklistTemplate[];
  sites: { id: string; name: string; company_id: string }[];
  employees: { id: string; full_name: string; companyIds: string[] }[];
}) {
  const [templateModal, setTemplateModal] = useState<ChecklistTemplate | "new" | null>(null);
  const [templateDetail, setTemplateDetail] = useState<ChecklistTemplate | null>(null);
  const [showAssign, setShowAssign] = useState(false);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-text-dark">Checklist Templates</div>
        <div className="flex gap-2">
          <button onClick={() => setTemplateModal("new")} className="flex items-center gap-2 rounded-[11px] bg-bg px-[18px] py-2.5 text-[13.5px] font-bold text-text-dark">
            <PlusIcon />
            Create Checklist
          </button>
          <PrimaryButton onClick={() => setShowAssign(true)}>
            <PlusIcon />
            Assign Checklist
          </PrimaryButton>
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-border p-8 text-center text-sm text-text-muted">
          No checklist templates yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {templates.map((template) => {
            const subtasks = template.areas.reduce((n, a) => n + a.subtasks.length, 0);
            return (
              <div key={template.id} className="flex items-center justify-between rounded-[16px] border border-border bg-white p-4">
                <button type="button" onClick={() => setTemplateDetail(template)} className="flex-1 text-left">
                  <div className="text-sm font-semibold text-text-dark">
                    {template.areas.map((a) => a.main_area).join(", ") || "Checklist"}
                  </div>
                  <div className="text-xs text-text-muted">{template.site} · {subtasks} subtasks</div>
                </button>
                <div className="flex items-center gap-2">
                  <IconChip onClick={() => setTemplateModal(template)} aria-label="Edit">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </IconChip>
                  <DeleteButton action={deleteTemplateAction} confirmText="Delete this template?" hiddenFields={{ id: template.id }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {templateModal && (
        <CreateTemplateModal
          companies={[{ id: companyId, name: companyName }]}
          sites={sites}
          template={templateModal === "new" ? undefined : templateModal}
          onClose={() => setTemplateModal(null)}
        />
      )}
      {templateDetail && (
        <TemplateDetailModal template={templateDetail} companyName={companyName} onClose={() => setTemplateDetail(null)} />
      )}
      {showAssign && (
        <AssignChecklistModal
          companies={[{ id: companyId, name: companyName }]}
          templates={templates}
          employees={employees}
          onClose={() => setShowAssign(false)}
        />
      )}
    </div>
  );
}
