"use client";

import { useState } from "react";
import { Badge, EmptyState, IconChip, PlusIcon, PrimaryButton, Table } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import type { Audit, AuditMainItem } from "@macro/shared/types";
import { deleteAuditAction } from "./actions";
import { AddAuditModal } from "./AddAuditModal";
import { AuditDetailModal } from "./AuditDetailModal";

const STATUS_TONE = { submit: "info", verify: "warning", complete: "success" } as const;
const STATUS_LABEL = { submit: "Pending", verify: "Saved", complete: "Completed" } as const;

type Stage = "ongoing" | "verified" | "submitted";
const TABS = ["all", "ongoing", "verified", "submitted"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { all: "All Audits", ongoing: "Ongoing", verified: "Verified", submitted: "Submitted" };
const STAGE_BADGE: Record<Stage, { tone: "warning" | "success" | "info"; label: string }> = {
  ongoing: { tone: "warning", label: "Ongoing" },
  verified: { tone: "success", label: "Verified" },
  submitted: { tone: "info", label: "Submitted" },
};
const EMPTY: Record<Tab, string> = {
  all: "No audits in the last 2 months",
  ongoing: "No audits waiting for the employee to check",
  verified: "No audits verified and waiting for a note and photos",
  submitted: "No audits submitted by employees yet",
};

/** Where the employee stands, as in the app: Ongoing until verified, then Verified, then Submitted. */
export function stageOf(a: Pick<Audit, "employee_submitted_at" | "employee_verified_at">): Stage {
  if (a.employee_submitted_at) return "submitted";
  if (a.employee_verified_at) return "verified";
  return "ongoing";
}

const when = (iso: string) => new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Sydney", dateStyle: "medium", timeStyle: "short" });

export interface AuditRow extends Audit {
  companyName: string;
  employeeName: string;
}

interface EmployeeOption {
  id: string;
  full_name: string;
  companyIds: string[];
  isClient?: boolean;
}
interface Site {
  id: string;
  name: string;
  company_id: string;
}

export function AuditsTable({
  audits,
  companies,
  sites,
  employees,
  photoUrls = {},
}: {
  audits: AuditRow[];
  companies: { id: string; name: string }[];
  sites: Site[];
  employees: EmployeeOption[];
  photoUrls?: Record<string, string>;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<AuditRow | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const count = (t: Stage) => audits.filter((a) => stageOf(a) === t).length;
  // Submitted ones: most recently submitted first.
  const shown =
    tab === "all"
      ? audits
      : audits
          .filter((a) => stageOf(a) === tab)
          .sort((x, y) => (tab === "submitted" ? (y.employee_submitted_at ?? "").localeCompare(x.employee_submitted_at ?? "") : 0));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-fit flex-wrap gap-1 rounded-lg bg-bg p-1" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-2 text-sm font-semibold ${tab === t ? "bg-white text-primary shadow-sm" : "text-text-muted"}`}
            >
              {TAB_LABEL[t]} · {t === "all" ? audits.length : count(t)}
            </button>
          ))}
        </div>
        <PrimaryButton onClick={() => setShowAdd(true)}>
          <PlusIcon />
          Add Audit
        </PrimaryButton>
      </div>

      {shown.length === 0 ? (
        <EmptyState title={EMPTY[tab]} />
      ) : tab === "submitted" ? (
        <Table head={["Submitted", "Company", "Employee", "Audit", "Employee note", "Photos", "Total Marks", "Status", "Actions"]}>
          {shown.map((audit) => {
            const status = audit.status as keyof typeof STATUS_TONE;
            const note = audit.employee_note ?? "";
            return (
              <tr key={audit.id} onClick={() => setSelected(audit)} className="cursor-pointer border-b border-border last:border-0">
                <td className="px-5 py-3.5 text-text-muted">{audit.employee_submitted_at ? when(audit.employee_submitted_at) : audit.date}</td>
                <td className="px-5 py-3.5 font-semibold text-text-dark">{audit.companyName}</td>
                <td className="px-5 py-3.5 text-text-muted">{audit.employeeName}</td>
                <td className="px-5 py-3.5 text-text-muted">{audit.title || "Untitled"}</td>
                <td className="max-w-[240px] px-5 py-3.5 text-[13px] text-text-muted">{note ? (note.length > 70 ? `${note.slice(0, 70)}…` : note) : "—"}</td>
                <td className="px-5 py-3.5 text-text-muted">{audit.employee_images?.length ?? 0}</td>
                <td className="px-5 py-3.5 text-text-muted">{audit.final_marks ?? "—"}/{audit.max_marks}</td>
                <td className="px-5 py-3.5">
                  <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? audit.status}</Badge>
                </td>
                <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                  <DeleteButton action={deleteAuditAction} confirmText="Delete this audit? This can't be undone." hiddenFields={{ id: audit.id }} />
                </td>
              </tr>
            );
          })}
        </Table>
      ) : (
      <Table head={["Date", "Company", "Employee", "Audit", "Employee status", "Sub-sections", "Total Marks", "Status", "Actions"]}>
        {shown.map((audit) => {
          const mainAudits = audit.main_audits as AuditMainItem[];
          const subAuditCount = mainAudits.reduce((n, m) => n + m.sub_audits.length, 0);
          const ratedCount = mainAudits.reduce((n, m) => n + m.sub_audits.filter((s) => s.result).length, 0);
          const status = audit.status as keyof typeof STATUS_TONE;
          return (
            <tr key={audit.id} className="border-b border-border last:border-0">
              <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => setSelected(audit)}>{audit.date}</td>
              <td className="cursor-pointer px-5 py-3.5 font-semibold text-text-dark" onClick={() => setSelected(audit)}>{audit.companyName}</td>
              <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => setSelected(audit)}>{audit.employeeName}</td>
              <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => setSelected(audit)}>{audit.title || "Untitled"}</td>
              <td className="cursor-pointer px-5 py-3.5" onClick={() => setSelected(audit)}>
                <Badge tone={STAGE_BADGE[stageOf(audit)].tone}>{STAGE_BADGE[stageOf(audit)].label}</Badge>
              </td>
              <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => setSelected(audit)}>{ratedCount}/{subAuditCount}</td>
              <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => setSelected(audit)}>{audit.final_marks ?? "—"}/{audit.max_marks}</td>
              <td className="cursor-pointer px-5 py-3.5" onClick={() => setSelected(audit)}>
                <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? audit.status}</Badge>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <IconChip onClick={() => setSelected(audit)} aria-label="Open">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </IconChip>
                  <DeleteButton action={deleteAuditAction} confirmText="Delete this audit? This can't be undone." hiddenFields={{ id: audit.id }} />
                </div>
              </td>
            </tr>
          );
        })}
      </Table>
      )}

      {showAdd && (
        <AddAuditModal companies={companies} sites={sites} employeeCompanyMap={employees} onClose={() => setShowAdd(false)} />
      )}

      {selected && (
        <AuditDetailModal
          audit={selected}
          companyName={selected.companyName}
          employeeName={selected.employeeName}
          companyEmployees={employees.filter((e) => e.companyIds.includes(selected.company_id))}
          photoUrls={photoUrls}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
