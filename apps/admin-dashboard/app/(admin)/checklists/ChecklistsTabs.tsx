"use client";

import { useState } from "react";
import { Badge, EmptyState, IconChip, PlusIcon, PrimaryButton, Table } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import type { Checklist, ChecklistTemplate } from "@macro/shared/types";
import { deleteTemplateAction } from "./actions";
import { CreateTemplateModal } from "./CreateTemplateModal";
import { TemplateDetailModal } from "./TemplateDetailModal";
import { AssignChecklistModal } from "./AssignChecklistModal";
import { ChecklistDetailModal } from "./ChecklistDetailModal";

interface JoinedChecklist extends Checklist {
  companyName: string;
  employeeName: string;
}
interface JoinedTemplate extends ChecklistTemplate {
  companyName: string;
}

const TABS = ["submitted", "create", "assign"] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = {
  submitted: "Daily Submitted Checklist",
  create: "Create Checklist",
  assign: "Assign Checklist",
};

export function ChecklistsTabs({
  submitted,
  templates,
  assigned,
  companies,
  employees,
}: {
  submitted: JoinedChecklist[];
  templates: JoinedTemplate[];
  assigned: JoinedChecklist[];
  companies: { id: string; name: string }[];
  employees: { id: string; full_name: string; companyIds: string[] }[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("submitted");
  const [templateModal, setTemplateModal] = useState<ChecklistTemplate | "new" | null>(null);
  const [templateDetail, setTemplateDetail] = useState<JoinedTemplate | null>(null);
  const [checklistDetail, setChecklistDetail] = useState<JoinedChecklist | null>(null);
  const [showAssign, setShowAssign] = useState(false);

  return (
    <div>
      <div className="mb-5 flex w-fit gap-1 rounded-lg bg-bg p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-4 py-2 text-sm font-semibold ${
              tab === t ? "bg-white text-primary shadow-sm" : "text-text-muted"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {tab === "submitted" &&
        (submitted.length === 0 ? (
          <EmptyState title="No submitted checklists yet" />
        ) : (
          <Table head={["Date", "Main Areas", "Company", "Employee", "Subtasks", "Notes", "Images"]}>
            {submitted.map((row) => {
              const done = row.areas.reduce((n, a) => n + a.subtasks.filter((t) => t.done).length, 0);
              const total = row.areas.reduce((n, a) => n + a.subtasks.length, 0);
              const notesPreview = row.notes
                ? row.notes.length > 60
                  ? `${row.notes.slice(0, 60)}…`
                  : row.notes
                : "—";
              return (
                <tr
                  key={row.id}
                  onClick={() => setChecklistDetail(row)}
                  className="cursor-pointer border-b border-border last:border-0"
                >
                  <td className="px-5 py-3.5 text-text-muted">{row.assigned_date}</td>
                  <td className="px-5 py-3.5 font-semibold text-text-dark">{row.areas.map((a) => a.main_area).join(", ")}</td>
                  <td className="px-5 py-3.5 text-text-muted">{row.companyName}</td>
                  <td className="px-5 py-3.5 text-text-muted">{row.employeeName}</td>
                  <td className="px-5 py-3.5 text-text-muted">{done}/{total}</td>
                  <td className="px-5 py-3.5 text-[13px] text-text-muted">{notesPreview}</td>
                  <td className="px-5 py-3.5 text-text-muted">{row.images.length}</td>
                </tr>
              );
            })}
          </Table>
        ))}

      {tab === "create" && (
        <div>
          <div className="mb-3 flex justify-end">
            <PrimaryButton onClick={() => setTemplateModal("new")}>
              <PlusIcon />
              New Checklist Template
            </PrimaryButton>
          </div>
          {templates.length === 0 ? (
            <EmptyState title="No checklist templates yet" />
          ) : (
            <Table head={["Company", "Site", "Subtasks", "Actions"]}>
              {templates.map((t) => {
                const subtasks = t.areas.reduce((n, a) => n + a.subtasks.length, 0);
                return (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="cursor-pointer px-5 py-3.5 font-semibold text-text-dark" onClick={() => setTemplateDetail(t)}>{t.companyName}</td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => setTemplateDetail(t)}>{t.site}</td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => setTemplateDetail(t)}>{subtasks}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <IconChip onClick={() => setTemplateModal(t)} aria-label="Edit">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </IconChip>
                        <DeleteButton action={deleteTemplateAction} confirmText="Delete this template?" hiddenFields={{ id: t.id }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </div>
      )}

      {tab === "assign" && (
        <div>
          <div className="mb-3 flex justify-end">
            <PrimaryButton onClick={() => setShowAssign(true)}>
              <PlusIcon />
              Assign Checklist
            </PrimaryButton>
          </div>
          {assigned.length === 0 ? (
            <EmptyState title="No checklists assigned yet" />
          ) : (
            <Table head={["Date", "Main Areas", "Company", "Employee", "Site", "Subtasks", "Status"]}>
              {assigned.map((row) => {
                const done = row.areas.reduce((n, a) => n + a.subtasks.filter((t) => t.done).length, 0);
                const total = row.areas.reduce((n, a) => n + a.subtasks.length, 0);
                return (
                  <tr key={row.id} onClick={() => setChecklistDetail(row)} className="cursor-pointer border-b border-border last:border-0">
                    <td className="px-5 py-3.5 text-text-muted">{row.assigned_date}</td>
                    <td className="px-5 py-3.5 font-semibold text-text-dark">{row.areas.map((a) => a.main_area).join(", ")}</td>
                    <td className="px-5 py-3.5 text-text-muted">{row.companyName}</td>
                    <td className="px-5 py-3.5 text-text-muted">{row.employeeName}</td>
                    <td className="px-5 py-3.5 text-text-muted">{row.site}</td>
                    <td className="px-5 py-3.5 text-text-muted">{done}/{total}</td>
                    <td className="px-5 py-3.5">
                      <Badge tone={row.status === "submitted" ? "success" : "warning"}>{row.status}</Badge>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}
        </div>
      )}

      {templateModal && (
        <CreateTemplateModal
          companies={companies}
          template={templateModal === "new" ? undefined : templateModal}
          onClose={() => setTemplateModal(null)}
        />
      )}
      {templateDetail && (
        <TemplateDetailModal template={templateDetail} companyName={templateDetail.companyName} onClose={() => setTemplateDetail(null)} />
      )}
      {checklistDetail && (
        <ChecklistDetailModal
          checklist={checklistDetail}
          companyName={checklistDetail.companyName}
          employeeName={checklistDetail.employeeName}
          onClose={() => setChecklistDetail(null)}
        />
      )}
      {showAssign && (
        <AssignChecklistModal companies={companies} templates={templates} employees={employees} onClose={() => setShowAssign(false)} />
      )}
    </div>
  );
}
