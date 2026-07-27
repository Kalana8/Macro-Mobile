"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { PrimaryButton, TextInput } from "@/components/ui";
import { EMPTY_PERMISSIONS } from "@macro/shared/rbac";
import type { RolePermissions, Role } from "@macro/shared/types";
import { APP_SCHEMA, DASHBOARD_SCHEMA } from "./permission-schema-labels";
import { saveRoleAction, type RoleFormState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending} className="flex-1">{pending ? "Saving…" : label}</PrimaryButton>;
}

function AreaGroup({
  schema,
  values,
  onToggleAll,
  onToggleFn,
}: {
  schema: typeof DASHBOARD_SCHEMA | typeof APP_SCHEMA;
  values: Record<string, Record<string, boolean>>;
  onToggleAll: (areaKey: string) => void;
  onToggleFn: (areaKey: string, fnKey: string) => void;
}) {
  return (
    <div className="flex max-h-[340px] flex-col gap-2.5 overflow-y-auto pr-1">
      {schema.map((area) => {
        const areaValues = values[area.key] ?? {};
        const allChecked = area.functions.every((f) => areaValues[f.key]);
        return (
          <div key={area.key} className="rounded-[10px] border border-border p-2.5">
            <button
              type="button"
              onClick={() => onToggleAll(area.key)}
              className="mb-1 flex w-full items-center gap-2 text-left"
            >
              <span className={`flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded border-2 ${allChecked ? "border-primary bg-primary" : "border-border"}`}>
                {allChecked && <span className="text-[9px] text-white">✓</span>}
              </span>
              <span className="text-[12.5px] font-bold text-text-dark">{area.label}</span>
            </button>
            <div className="flex flex-col gap-0.5 pl-[22px]">
              {area.functions.map((fn) => {
                const checked = Boolean(areaValues[fn.key]);
                return (
                  <button
                    type="button"
                    key={fn.key}
                    onClick={() => onToggleFn(area.key, fn.key)}
                    className="flex items-center gap-2 py-0.5 text-left"
                  >
                    <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border-2 ${checked ? "border-primary bg-primary" : "border-border"}`}>
                      {checked && <span className="text-[8px] text-white">✓</span>}
                    </span>
                    <span className="text-[11.5px] text-text-muted">{fn.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RoleModal({ role, onClose }: { role?: Role; onClose: () => void }) {
  const isEdit = Boolean(role);
  const [state, formAction] = useActionState<RoleFormState, FormData>(saveRoleAction, {});
  const [permissions, setPermissions] = useState<RolePermissions>(role?.permissions ?? EMPTY_PERMISSIONS);

  useEffect(() => {
    if (state.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  function toggleAll(side: "dashboard" | "app", areaKey: string) {
    const schema = side === "dashboard" ? DASHBOARD_SCHEMA : APP_SCHEMA;
    const area = schema.find((a) => a.key === areaKey)!;
    setPermissions((prev) => {
      const areaValues = (prev[side] as unknown as Record<string, Record<string, boolean>>)[areaKey] ?? {};
      const allChecked = area.functions.every((f) => areaValues[f.key]);
      const next = Object.fromEntries(area.functions.map((f) => [f.key, !allChecked]));
      return { ...prev, [side]: { ...prev[side], [areaKey]: next } };
    });
  }
  function toggleFn(side: "dashboard" | "app", areaKey: string, fnKey: string) {
    setPermissions((prev) => {
      const areaValues = (prev[side] as unknown as Record<string, Record<string, boolean>>)[areaKey] ?? {};
      return {
        ...prev,
        [side]: { ...prev[side], [areaKey]: { ...areaValues, [fnKey]: !areaValues[fnKey] } },
      };
    });
  }

  return (
    <Modal title={isEdit ? "Edit Role" : "New Role"} onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        {isEdit && <input type="hidden" name="roleId" value={role!.id} />}
        <input type="hidden" name="permissionsJson" value={JSON.stringify(permissions)} />
        <div>
          <div className="mb-1.5 text-xs font-semibold text-text-muted">ROLE NAME</div>
          <TextInput name="name" required defaultValue={role?.name} placeholder="e.g. Supervisor" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="mb-2 text-[11px] font-bold text-text-muted">DASHBOARD — PAGES &amp; FUNCTIONS</div>
            <AreaGroup
              schema={DASHBOARD_SCHEMA}
              values={permissions.dashboard as unknown as Record<string, Record<string, boolean>>}
              onToggleAll={(k) => toggleAll("dashboard", k)}
              onToggleFn={(a, f) => toggleFn("dashboard", a, f)}
            />
          </div>
          <div>
            <div className="mb-2 text-[11px] font-bold text-text-muted">APP — PAGES &amp; FUNCTIONS</div>
            <AreaGroup
              schema={APP_SCHEMA}
              values={permissions.app as unknown as Record<string, Record<string, boolean>>}
              onToggleAll={(k) => toggleAll("app", k)}
              onToggleFn={(a, f) => toggleFn("app", a, f)}
            />
          </div>
        </div>

        {state.error && (
          <div className="text-[12.5px] text-error-text">{state.error}</div>
        )}

        <div className="mt-1 flex gap-2.5">
          <button type="button" onClick={onClose} className="flex-1 rounded-[12px] bg-bg py-3 text-sm font-bold text-text-dark">
            Cancel
          </button>
          <SubmitButton label={isEdit ? "Save Changes" : "Create Role"} />
        </div>
      </form>
    </Modal>
  );
}
