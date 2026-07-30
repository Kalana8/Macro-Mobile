"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { FieldLabel, PrimaryButton, Select, TextInput } from "@/components/ui";
import { PasswordInput } from "@/components/PasswordInput";
import { createEmployeeAction, type EmployeeFormState } from "./actions";

interface RoleOption {
  id: string;
  name: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Creating…" : "Create Login"}</PrimaryButton>;
}

export function AddEmployeeModal({ roles, onClose }: { roles: RoleOption[]; onClose: () => void }) {
  const [state, formAction] = useActionState<EmployeeFormState, FormData>(createEmployeeAction, {});

  useEffect(() => {
    if (state.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Modal title="Add Employee" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        <div>
          <FieldLabel>Full Name</FieldLabel>
          <TextInput name="fullName" required />
        </div>
        <div>
          <FieldLabel>Role (job title)</FieldLabel>
          <TextInput name="jobRole" placeholder="e.g. Field Auditor" />
        </div>
        <div>
          <FieldLabel>Access Role</FieldLabel>
          <Select name="accessRoleId" required defaultValue="">
            <option value="" disabled>Select access role</option>
            {roles.map((role) => (
              <option key={role.id} value={role.id}>{role.name}</option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel>Username (login email)</FieldLabel>
          <TextInput type="email" name="username" required autoComplete="off" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Password</FieldLabel>
            <PasswordInput name="password" required minLength={8} autoComplete="new-password" />
          </div>
          <div>
            <FieldLabel>Confirm Password</FieldLabel>
            <PasswordInput name="confirmPassword" required minLength={8} autoComplete="new-password" />
          </div>
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
