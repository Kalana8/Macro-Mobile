"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { FieldLabel, PrimaryButton, Select, TextInput } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";
import { updateEmployeeAction, type EmployeeFormState } from "./actions";
import type { EmployeeRow } from "./EmployeesTable";

interface RoleOption {
  id: string;
  name: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save Changes"}</PrimaryButton>;
}

export function EditEmployeeModal({
  employee,
  roles,
  onClose,
}: {
  employee: EmployeeRow;
  roles: RoleOption[];
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<EmployeeFormState, FormData>(updateEmployeeAction, {});
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  useEffect(() => {
    if (state.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Modal title="Edit Employee" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        <input type="hidden" name="id" value={employee.id} />

        <div>
          <FieldLabel>Full Name</FieldLabel>
          <TextInput name="fullName" required defaultValue={employee.full_name} />
        </div>
        <div>
          <FieldLabel>Role (job title)</FieldLabel>
          <TextInput name="jobRole" placeholder="e.g. Field Auditor" defaultValue={employee.job_role} />
        </div>
        <div>
          <FieldLabel>Access Role</FieldLabel>
          <Select name="accessRoleId" required defaultValue={employee.accessRoleId}>
            <option value="" disabled>Select access role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel>Username (login email)</FieldLabel>
          <TextInput type="email" name="username" required autoComplete="off" defaultValue={employee.username} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Phone</FieldLabel>
            <TextInput name="phone" defaultValue={employee.phone ?? ""} />
          </div>
          <div>
            <FieldLabel>Department</FieldLabel>
            <TextInput name="department" defaultValue={employee.department ?? ""} />
          </div>
        </div>
        <div>
          <FieldLabel>Status</FieldLabel>
          <Select name="status" defaultValue={employee.status}>
            <option value="active">Active</option>
            <option value="on_leave">On Leave</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        <div className="rounded-xl border border-border p-3.5">
          {showPasswordReset ? (
            <>
              <div className="mb-2.5 flex items-center justify-between">
                <div className="text-xs font-bold text-text-muted">RESET PASSWORD</div>
                <button
                  type="button"
                  onClick={() => setShowPasswordReset(false)}
                  className="text-[12.5px] font-semibold text-primary"
                >
                  Cancel
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>New Password</FieldLabel>
                  <PasswordInput name="newPassword" minLength={8} autoComplete="new-password" />
                </div>
                <div>
                  <FieldLabel>Confirm New Password</FieldLabel>
                  <PasswordInput name="confirmNewPassword" minLength={8} autoComplete="new-password" />
                </div>
              </div>
              <p className="mt-2 text-[11.5px] text-text-muted">
                The employee will be required to set their own new password at next login.
              </p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setShowPasswordReset(true)}
              className="text-[13px] font-semibold text-primary"
            >
              Reset Password
            </button>
          )}
        </div>

        {state.error && <div className="text-[12.5px] text-error-text">{state.error}</div>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
            Cancel
          </button>
          <SubmitButton />
        </div>
      </form>
    </Modal>
  );
}
