"use client";

import { useState } from "react";
import { cycleEnded } from "@macro/shared/checklistCycle";
import { Badge, CheckboxSquare, EmptyState, IconChip, PlusIcon, PrimaryButton, Table } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import { todayInBusinessTimezone } from "@macro/shared/datetime";
import type { Checklist, ChecklistTemplate, Site } from "@macro/shared/types";
import { scheduleSummary } from "../companies/siteSchedule";
import { deleteAssignmentAction, deleteTemplateAction } from "./actions";
import { CreateTemplateModal } from "./CreateTemplateModal";
import { TemplateDetailModal } from "./TemplateDetailModal";
import { AssignChecklistModal } from "./AssignChecklistModal";
import { ChecklistDetailModal } from "./ChecklistDetailModal";
import { EndTemplateButton } from "./EndTemplateButton";
import { SendNowButton } from "./SendNowButton";
import { ShareChecklistsModal } from "./ShareChecklistsModal";
import { dueMomentLabel, effectiveDueHours, hourNowInBusinessTimezone, hoursSinceDayStart, templateSubtaskCount } from "./templateContent";
import { ExtendChecklistModal } from "./ExtendChecklistModal";
import { PairSelect } from "./PairSelect";

interface JoinedChecklist extends Checklist {
  companyName: string;
  employeeName: string;
}
interface JoinedTemplate extends ChecklistTemplate {
  companyName: string;
  site: string;
}

const TABS = ["submitted", "expired", "create", "assign"] as const;
const TAB_LABEL: Record<(typeof TABS)[number], string> = {
  submitted: "Daily Submitted Checklist",
  expired: "Expired Checklists",
  create: "Create Checklist",
  assign: "Assign Checklist",
};

interface AssignmentRow {
  id: string;
  templateId: string;
  employeeId: string;
  /** Paired assignments share this (migration 0072). */
  pairId: string | null;
  adminNote: string | null;
  companyName: string;
  employeeName: string;
  site: string;
}

export function ChecklistsTabs({
  submitted,
  pending,
  templates,
  assignments,
  companies,
  sites,
  employees,
}: {
  submitted: JoinedChecklist[];
  /** Still to do (last 2 months), for the Expired tab. */
  pending: JoinedChecklist[];
  templates: JoinedTemplate[];
  assignments: AssignmentRow[];
  companies: { id: string; name: string }[];
  sites: Site[];
  employees: { id: string; full_name: string; companyIds: string[] }[];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("submitted");
  const [templateModal, setTemplateModal] = useState<ChecklistTemplate | "new" | null>(null);
  const [templateDetail, setTemplateDetail] = useState<JoinedTemplate | null>(null);
  const [checklistDetail, setChecklistDetail] = useState<JoinedChecklist | null>(null);
  const [showAssign, setShowAssign] = useState(false);
  const [extending, setExtending] = useState<JoinedChecklist | null>(null);
  // Expired: past their done-by time (or extension). Extended: given more time and still on time.
  const today = todayInBusinessTimezone();
  const hourNow = hourNowInBusinessTimezone();
  const lateRows = pending
    .map((c) => ({ c, due: effectiveDueHours(c), elapsed: hoursSinceDayStart(c.assigned_date, today, hourNow) }))
    .filter((r) => r.elapsed >= r.due || r.c.extended_due_hours != null);
  const [selected, setSelected] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const chosen = submitted.filter((c) => selected.includes(c.id));
  const allChosen = submitted.length > 0 && chosen.length === submitted.length;
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

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
          <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[13px] text-text-muted">
              {chosen.length ? `${chosen.length} selected` : "Tick checklists to share them together, or open one to share it."}
            </div>
            <div className="flex items-center gap-2">
              {chosen.length > 0 && (
                <button type="button" onClick={() => setSelected([])} className="text-[13px] font-semibold text-primary">
                  Clear
                </button>
              )}
              <PrimaryButton type="button" onClick={() => setSharing(true)} disabled={chosen.length === 0}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
                </svg>
                {chosen.length ? `Share ${chosen.length}` : "Share"}
              </PrimaryButton>
            </div>
          </div>
          <Table
            head={[
              <button
                key="all"
                type="button"
                role="checkbox"
                aria-checked={allChosen}
                aria-label={allChosen ? "Clear all" : "Select all"}
                onClick={() => setSelected(allChosen ? [] : submitted.map((c) => c.id))}
                className="flex items-center"
              >
                <CheckboxSquare checked={allChosen} />
              </button>,
              "Date", "Main Areas", "Company", "Employee", "Subtasks", "Notes", "Images",
            ]}
          >
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
                  className={`cursor-pointer border-b border-border last:border-0 ${selected.includes(row.id) ? "bg-primary/5" : ""}`}
                >
                  <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={selected.includes(row.id)}
                      aria-label={`Select ${row.areas.map((a) => a.main_area).join(", ")}, ${row.assigned_date}`}
                      onClick={() => toggle(row.id)}
                      className="flex items-center"
                    >
                      <CheckboxSquare checked={selected.includes(row.id)} />
                    </button>
                  </td>
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
          </>
        ))}

      {tab === "expired" &&
        (lateRows.length === 0 ? (
          <EmptyState title="No expired checklists" />
        ) : (
          <>
            <div className="mb-3 text-[13px] text-text-muted">
              Checklists not submitted by their done-by time (last 2 months). Extend one to give the employee more time; it shows as on time in the app until then.
            </div>
            <Table head={["Date", "Company", "Site", "Employee", "Subtasks", "Due", "Actions"]}>
              {lateRows.map(({ c, due, elapsed }) => {
                const done = c.areas.reduce((n, a) => n + a.subtasks.filter((t) => t.done).length, 0);
                const total = c.areas.reduce((n, a) => n + a.subtasks.length, 0);
                const onTime = elapsed < due;
                return (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-3.5 text-text-muted">{c.assigned_date}</td>
                    <td className="px-5 py-3.5 font-semibold text-text-dark">{c.companyName}</td>
                    <td className="px-5 py-3.5 text-text-muted">{c.site}</td>
                    <td className="px-5 py-3.5 text-text-muted">{c.employeeName}</td>
                    <td className="px-5 py-3.5 text-text-muted">{done}/{total}</td>
                    <td className="px-5 py-3.5 text-[13px] text-text-muted">
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={onTime ? "success" : "error"}>{onTime ? "Extended" : "Expired"}</Badge>
                        <span>{onTime ? "until" : "was due"} {dueMomentLabel(c.assigned_date, due)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => setExtending(c)}
                        className="rounded-[10px] border border-primary px-3 py-1.5 text-[12.5px] font-bold text-primary"
                      >
                        {onTime ? "Change" : "Extend to…"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </Table>
          </>
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
            <Table head={["Company", "Site", "Schedule", "Subtasks", "Actions"]}>
              {templates.map((t) => {
                const subtasks = templateSubtaskCount(t);
                // Defensive against rows fetched before visit_dates existed
                // on this table (mid-migration).
                const visitDates = t.visit_dates ?? [];
                const ended = t.cycle_start
                  ? cycleEnded(t, todayInBusinessTimezone())
                  : visitDates.length > 0 && !visitDates.some((d) => d >= todayInBusinessTimezone());
                return (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="cursor-pointer px-5 py-3.5 font-semibold text-text-dark" onClick={() => setTemplateDetail(t)}>{t.companyName}</td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => setTemplateDetail(t)}>{t.site}</td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => setTemplateDetail(t)}>
                      <div className="flex items-center gap-1.5">
                        {scheduleSummary(t)}
                        {ended && <Badge tone="neutral">Ended</Badge>}
                      </div>
                    </td>
                    <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => setTemplateDetail(t)}>{subtasks}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <IconChip onClick={() => setTemplateModal(t)} aria-label="Edit">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </IconChip>
                        {!ended && (
                          <EndTemplateButton
                            templateId={t.id}
                            confirmText="Stop this checklist from repeating? It will no longer be sent from tomorrow on."
                          />
                        )}
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

          <div className="mb-2 text-xs font-bold text-text-muted">
            STANDING ASSIGNMENTS — sent automatically on every day of the checklist&apos;s schedule. Send now sends today&apos;s checklist straight away. Pair two people on the same checklist and one submit covers both.
          </div>
          {assignments.length === 0 ? (
            <div className="mb-6 rounded-[16px] border border-dashed border-border p-6 text-center text-sm text-text-muted">
              No standing assignments yet.
            </div>
          ) : (
            <Table head={["Company", "Site", "Employee", "Pair", "Note", "Actions"]}>
              {assignments.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3.5 font-semibold text-text-dark">{row.companyName}</td>
                  <td className="px-5 py-3.5 text-text-muted">{row.site}</td>
                  <td className="px-5 py-3.5 text-text-muted">{row.employeeName}</td>
                  <td className="px-5 py-3.5">
                    <PairSelect
                      assignmentId={row.id}
                      pairId={row.pairId}
                      options={assignments
                        .filter((o) => o.templateId === row.templateId && o.id !== row.id)
                        .map((o) => ({ assignmentId: o.id, name: o.employeeName, pairId: o.pairId }))}
                    />
                  </td>
                  <td className="px-5 py-3.5 text-[13px] text-text-muted">{row.adminNote ?? "—"}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-start gap-2">
                    <SendNowButton assignmentId={row.id} employeeName={row.employeeName} />
                    <DeleteButton
                      action={deleteAssignmentAction}
                      confirmText={`Stop auto-sending this checklist to ${row.employeeName}?`}
                      hiddenFields={{ id: row.id }}
                    />
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          )}

        </div>
      )}

      {templateModal && (
        <CreateTemplateModal
          companies={companies}
          sites={sites}
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
      {extending && (
        <ExtendChecklistModal
          checklist={extending}
          companyName={extending.companyName}
          employeeName={extending.employeeName}
          onClose={() => setExtending(null)}
        />
      )}
      {sharing && chosen.length > 0 && <ShareChecklistsModal checklists={chosen} onClose={() => setSharing(false)} />}
      {showAssign && (
        <AssignChecklistModal companies={companies} templates={templates} employees={employees} onClose={() => setShowAssign(false)} />
      )}
    </div>
  );
}
