"use client";

import { useState } from "react";
import { Badge, PlusIcon, PrimaryButton, Table } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import { removeEmployeeFromCompanyAction } from "../actions";
import { AssignEmployeeModal } from "./AssignEmployeeModal";

interface EmployeeRow {
  id: string;
  full_name: string;
  job_role: string;
  status: string;
}

export function CompanyEmployees({
  companyId,
  companyName,
  employees,
  candidates,
}: {
  companyId: string;
  companyName: string;
  employees: EmployeeRow[];
  candidates: { id: string; full_name: string }[];
}) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold text-text-dark">Employees</div>
        <PrimaryButton onClick={() => setShowModal(true)}>
          <PlusIcon />
          Add Employee
        </PrimaryButton>
      </div>

      {employees.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-border p-8 text-center text-sm text-text-muted">
          No employees assigned yet.
        </div>
      ) : (
        <Table head={["Name", "Role", "Status", ""]}>
          {employees.map((employee) => (
            <tr key={employee.id} className="border-b border-border last:border-0">
              <td className="px-5 py-3.5 font-semibold text-text-dark">{employee.full_name}</td>
              <td className="px-5 py-3.5 text-text-muted">{employee.job_role || "—"}</td>
              <td className="px-5 py-3.5">
                <Badge tone={employee.status === "active" ? "success" : "neutral"}>{employee.status}</Badge>
              </td>
              <td className="px-5 py-3.5">
                <DeleteButton
                  action={removeEmployeeFromCompanyAction}
                  confirmText={`Remove ${employee.full_name} from ${companyName}?`}
                  hiddenFields={{ companyId, employeeId: employee.id }}
                />
              </td>
            </tr>
          ))}
        </Table>
      )}

      {showModal && (
        <AssignEmployeeModal
          companyId={companyId}
          companyName={companyName}
          candidates={candidates}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
