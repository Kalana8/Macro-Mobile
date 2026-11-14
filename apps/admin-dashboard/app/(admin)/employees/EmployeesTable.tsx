"use client";

import { useState } from "react";
import { Badge, EmptyState, IconChip, PlusIcon, PrimaryButton, Table } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteEmployeeAction } from "./actions";
import { AddEmployeeModal } from "./AddEmployeeModal";
import { EditEmployeeModal } from "./EditEmployeeModal";
import Link from "next/link";
import { CHECK_TONE, type CheckState } from "@/lib/checks";

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  on_leave: "On Leave",
  inactive: "Inactive",
};

export interface EmployeeRow {
  id: string;
  full_name: string;
  username: string;
  job_role: string;
  status: string;
  phone: string | null;
  department: string | null;
  accessRoleId: string;
  companyNames: string[];
  roleName: string;
  /** Inductions sent to them and how many are done. */
  inductions: { done: number; total: number; toReview: number };
  /** Each required check, e.g. Police Check: approved. Empty until migration 0057. */
  checks: { name: string; state: CheckState }[];
}

const CHECK_SHORT: Record<CheckState, string> = {
  missing: "✗",
  submitted: "review",
  approved: "✓",
  rejected: "sent back",
  expired: "expired",
};

function InductionCell({ i }: { i: EmployeeRow["inductions"] }) {
  if (i.total === 0) return <span className="text-text-muted">None sent</span>;
  if (i.done === i.total) return <Badge tone="success">Done</Badge>;
  return (
    <div className="flex flex-col items-start gap-0.5">
      <Badge tone={i.toReview > 0 ? "warning" : "error"}>{i.toReview > 0 ? "To review" : "Not done"}</Badge>
      <span className="text-[11px] text-text-muted">{i.done}/{i.total} done</span>
    </div>
  );
}

function ChecksCell({ checks }: { checks: EmployeeRow["checks"] }) {
  if (checks.length === 0) return <span className="text-text-muted">—</span>;
  return (
    <Link href="/inductions/checks" className="flex flex-wrap gap-1" title="Open Checks">
      {checks.map((c) => (
        <Badge key={c.name} tone={CHECK_TONE[c.state]}>
          {c.name.replace(/\s*check$/i, "")} {CHECK_SHORT[c.state]}
        </Badge>
      ))}
    </Link>
  );
}

export function EmployeesTable({
  employees,
  roles,
}: {
  employees: EmployeeRow[];
  roles: { id: string; name: string }[];
}) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <PrimaryButton onClick={() => setShowModal(true)}>
          <PlusIcon />
          Add Employee
        </PrimaryButton>
      </div>

      {employees.length === 0 ? (
        <EmptyState title="No employees yet" hint="Add your first employee to provision their login." />
      ) : (
      <Table head={["Name", "Username", "Company", "Role", "Induction", "Checks", "Status", ""]}>
        {employees.map((employee) => (
          <tr key={employee.id} className="border-b border-border last:border-0">
            <td className="px-5 py-3.5 font-semibold text-text-dark">{employee.full_name}</td>
            <td className="px-5 py-3.5 text-text-muted">{employee.username}</td>
            <td className="px-5 py-3.5 text-text-muted">{employee.companyNames.join(", ") || "—"}</td>
            <td className="px-5 py-3.5 text-text-muted">{employee.job_role || "—"} <span className="text-xs">({employee.roleName})</span></td>
            <td className="px-5 py-3.5"><InductionCell i={employee.inductions} /></td>
            <td className="px-5 py-3.5"><ChecksCell checks={employee.checks} /></td>
            <td className="px-5 py-3.5">
              <Badge tone={employee.status === "active" ? "success" : "neutral"}>
                {STATUS_LABEL[employee.status] ?? employee.status}
              </Badge>
            </td>
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-2">
                <IconChip onClick={() => setEditing(employee)} aria-label="Edit">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </IconChip>
                <DeleteButton
                  action={deleteEmployeeAction}
                  confirmText={`Delete ${employee.full_name}'s login? This can't be undone.`}
                  hiddenFields={{ id: employee.id }}
                />
              </div>
            </td>
          </tr>
        ))}
      </Table>
      )}

      {showModal && <AddEmployeeModal roles={roles} onClose={() => setShowModal(false)} />}
      {editing && <EditEmployeeModal employee={editing} roles={roles} onClose={() => setEditing(null)} />}
    </div>
  );
}
