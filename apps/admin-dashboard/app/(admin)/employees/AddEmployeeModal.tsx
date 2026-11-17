"use client";

import { useActionState, useState } from "react";
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

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // still visible to select by hand
        }
      }}
      className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-bold text-white"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

export function AddEmployeeModal({ roles, onClose }: { roles: RoleOption[]; onClose: () => void }) {
  const [state, formAction] = useActionState<EmployeeFormState, FormData>(createEmployeeAction, {});
  // Shown here right after creating; the Employees page keeps an encrypted copy until they set their own.
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  if (state.success) {
    return (
      <Modal title="Login Created" onClose={onClose}>
        <div className="flex flex-col gap-3.5">
          <div className="rounded-lg bg-olive/15 px-3.5 py-3 text-sm font-semibold text-olive-text">
            Copy these and send them to the employee. You can see them again on the Employees page until the employee sets their own password at first sign-in.
          </div>
          <div>
            <FieldLabel>Username</FieldLabel>
            <div className="flex gap-2">
              <TextInput readOnly value={username} onFocus={(e) => e.target.select()} className="flex-1" />
              <CopyButton value={username} label="Copy" />
            </div>
          </div>
          <div>
            <FieldLabel>Password</FieldLabel>
            <div className="flex gap-2">
              <TextInput readOnly value={password} onFocus={(e) => e.target.select()} className="flex-1 font-mono" />
              <CopyButton value={password} label="Copy" />
            </div>
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <CopyButton value={`Username: ${username}\nPassword: ${password}`} label="Copy both" />
            <PrimaryButton onClick={onClose}>Done</PrimaryButton>
          </div>
        </div>
      </Modal>
    );
  }

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
          <TextInput type="email" name="username" required autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value.trim())} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Password</FieldLabel>
            <PasswordInput name="password" required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
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
