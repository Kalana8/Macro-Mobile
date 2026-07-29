"use client";

import { useState } from "react";
import { Badge, EmptyState, IconChip, PlusIcon, PrimaryButton, Table } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteEmployeeAction } from "./actions";
import { AddEmployeeModal } from "./AddEmployeeModal";
import { EditEmployeeModal } from "./EditEmployeeModal";

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
      <Table head={["Name", "Username", "Company", "Role", "Status", ""]}>
        {employees.map((employee) => (
          <tr key={employee.id} className="border-b border-border last:border-0">
            <td className="px-5 py-3.5 font-semibold text-text-dark">{employee.full_name}</td>
            <td className="px-5 py-3.5 text-text-muted">{employee.username}</td>
            <td className="px-5 py-3.5 text-text-muted">{employee.companyNames.join(", ") || "—"}</td>
            <td className="px-5 py-3.5 text-text-muted">{employee.job_role || "—"} <span className="text-xs">({employee.roleName})</span></td>
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
