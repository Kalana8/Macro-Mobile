"use client";

import { useState } from "react";
import { Badge, EmptyState, IconChip, PlusIcon, PrimaryButton, Table } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import type { Audit, AuditMainItem } from "@macro/shared/types";
import { deleteAuditAction } from "./actions";
import { AddAuditModal } from "./AddAuditModal";
import { AuditDetailModal } from "./AuditDetailModal";

const STATUS_TONE = { submit: "info", verify: "warning", complete: "success" } as const;

export interface AuditRow extends Audit {
  companyName: string;
  employeeName: string;
}

interface EmployeeOption {
  id: string;
  full_name: string;
  companyIds: string[];
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
}: {
  audits: AuditRow[];
  companies: { id: string; name: string }[];
  sites: Site[];
  employees: EmployeeOption[];
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <PrimaryButton onClick={() => setShowAdd(true)}>
          <PlusIcon />
          Add Audit
        </PrimaryButton>
      </div>

      {audits.length === 0 ? (
        <EmptyState title="No audits in the last 2 months" />
      ) : (
      <Table head={["Date", "Company", "Employee", "Audit", "Sub-audits", "Total Marks", "Status", "Actions"]}>
        {audits.map((audit) => {
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
              <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => setSelected(audit)}>{ratedCount}/{subAuditCount}</td>
              <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => setSelected(audit)}>{audit.final_marks ?? "—"}/{audit.max_marks}</td>
              <td className="cursor-pointer px-5 py-3.5" onClick={() => setSelected(audit)}>
                <Badge tone={STATUS_TONE[status] ?? "neutral"}>{status?.charAt(0).toUpperCase() + status?.slice(1)}</Badge>
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
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
