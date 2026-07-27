"use client";

import { useState } from "react";
import { Badge, EmptyState, PlusIcon, PrimaryButton, Table } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import { deleteEmployeeAction } from "./actions";
import { AddEmployeeModal } from "./AddEmployeeModal";

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
              <DeleteButton
                action={deleteEmployeeAction}
                confirmText={`Delete ${employee.full_name}'s login? This can't be undone.`}
                hiddenFields={{ id: employee.id }}
              />
            </td>
          </tr>
        ))}
      </Table>
      )}

      {showModal && <AddEmployeeModal roles={roles} onClose={() => setShowModal(false)} />}
    </div>
  );
}
