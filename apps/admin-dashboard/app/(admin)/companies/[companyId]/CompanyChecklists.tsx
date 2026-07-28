"use client";

import { useState } from "react";
import { Badge, Card, PlusIcon, PrimaryButton } from "@/components/ui";
import type { Checklist, ChecklistTemplate } from "@macro/shared/types";
import { CreateTemplateModal } from "../../checklists/CreateTemplateModal";
import { AssignChecklistModal } from "../../checklists/AssignChecklistModal";
import { ChecklistDetailModal } from "../../checklists/ChecklistDetailModal";

interface JoinedChecklist extends Checklist {
  employeeName: string;
}

export function CompanyChecklists({
  companyId,
  companyName,
  checklists,
  templates,
  sites,
  employees,
}: {
  companyId: string;
  companyName: string;
  checklists: JoinedChecklist[];
  templates: ChecklistTemplate[];
  sites: { id: string; name: string; company_id: string }[];
  employees: { id: string; full_name: string; companyIds: string[] }[];
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [selected, setSelected] = useState<JoinedChecklist | null>(null);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-text-dark">Daily Checklists</div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-[11px] bg-bg px-[18px] py-2.5 text-[13.5px] font-bold text-text-dark">
            <PlusIcon />
            Create Checklist
          </button>
          <PrimaryButton onClick={() => setShowAssign(true)}>
            <PlusIcon />
            Assign Checklist
          </PrimaryButton>
        </div>
      </div>

      {checklists.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-border p-8 text-center text-sm text-text-muted">
          No checklists yet.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {checklists.map((checklist) => {
            const doneCount = checklist.areas.reduce((n, a) => n + a.subtasks.filter((t) => t.done).length, 0);
            const totalCount = checklist.areas.reduce((n, a) => n + a.subtasks.length, 0);
            return (
              <Card key={checklist.id} className="flex cursor-pointer items-center justify-between" >
                <button type="button" onClick={() => setSelected(checklist)} className="flex flex-1 items-center justify-between text-left">
                  <div>
                    <div className="text-sm font-semibold text-text-dark">
                      {checklist.areas.map((a) => a.main_area).join(", ") || "Checklist"}
                    </div>
                    <div className="text-xs text-text-muted">
                      {checklist.employeeName} · {checklist.site} · {doneCount}/{totalCount} subtasks
                    </div>
                  </div>
                  <Badge tone={checklist.status === "submitted" ? "success" : "warning"}>
                    {checklist.status === "submitted" ? "Submitted" : "Pending Review"}
                  </Badge>
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateTemplateModal companies={[{ id: companyId, name: companyName }]} sites={sites} onClose={() => setShowCreate(false)} />
      )}
      {showAssign && (
        <AssignChecklistModal
          companies={[{ id: companyId, name: companyName }]}
          templates={templates}
          employees={employees}
          onClose={() => setShowAssign(false)}
        />
      )}
      {selected && (
        <ChecklistDetailModal
          checklist={selected}
          companyName={companyName}
          employeeName={selected.employeeName}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
