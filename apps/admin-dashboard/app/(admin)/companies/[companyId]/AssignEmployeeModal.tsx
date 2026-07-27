"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { CheckboxSquare, PrimaryButton } from "@/components/ui";
import { assignEmployeeToCompanyAction } from "../actions";

interface EmployeeOption {
  id: string;
  full_name: string;
}

export function AssignEmployeeModal({
  companyId,
  companyName,
  candidates,
  onClose,
}: {
  companyId: string;
  companyName: string;
  candidates: EmployeeOption[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  return (
    <Modal title={`Add Employee to ${companyName}`} onClose={onClose}>
      <div className="-mt-2.5 mb-4 text-[13px] text-text-muted">Select from existing employees</div>
      <form action={assignEmployeeToCompanyAction} onSubmit={onClose} className="flex flex-col gap-3">
        <input type="hidden" name="companyId" value={companyId} />
        {selected.map((id) => (
          <input key={id} type="hidden" name="employeeIds" value={id} />
        ))}

        <div className="max-h-72 overflow-y-auto rounded-[11px] border border-border p-2">
          {candidates.length === 0 ? (
            <div className="p-2 text-sm text-text-muted">No employees available.</div>
          ) : (
            candidates.map((employee) => (
              <button
                type="button"
                key={employee.id}
                onClick={() => toggle(employee.id)}
                className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-[7px] text-left text-[13.5px] text-text-dark"
              >
                <CheckboxSquare checked={selected.includes(employee.id)} />
                {employee.full_name}
              </button>
            ))
          )}
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
            Cancel
          </button>
          <PrimaryButton type="submit" disabled={selected.length === 0}>Add</PrimaryButton>
        </div>
      </form>
    </Modal>
  );
}
