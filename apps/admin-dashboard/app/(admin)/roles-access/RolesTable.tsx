"use client";

import { useState } from "react";
import { Badge, EmptyState, IconChip, PlusIcon, PrimaryButton, Table } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import type { Role, RolePermissions } from "@macro/shared/types";
import { APP_SCHEMA, DASHBOARD_SCHEMA } from "./permission-schema-labels";
import { deleteRoleAction } from "./actions";
import { RoleModal } from "./RoleModal";

/** "{Label} (onCount/totalFunctions)" per area with any function enabled, comma-joined — matches the mockup's summarize() exactly. */
function summarize(
  permissions: RolePermissions | undefined,
  schema: typeof DASHBOARD_SCHEMA | typeof APP_SCHEMA,
  side: "dashboard" | "app"
): string {
  const fallback = side === "dashboard" ? "No dashboard access" : "No app access";
  if (!permissions) return fallback;
  const sideValues = permissions[side] as unknown as Record<string, Record<string, boolean>>;
  const parts = schema
    .map((area) => {
      const areaValues = sideValues[area.key] ?? {};
      const onCount = area.functions.filter((f) => areaValues[f.key]).length;
      return onCount ? `${area.label} (${onCount}/${area.functions.length})` : null;
    })
    .filter((x): x is string => Boolean(x));
  return parts.length ? parts.join(", ") : fallback;
}

export function RolesTable({ roles, employeeCounts }: { roles: Role[]; employeeCounts: Record<string, number> }) {
  const [modalRole, setModalRole] = useState<Role | "new" | null>(null);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <PrimaryButton onClick={() => setModalRole("new")}>
          <PlusIcon />
          New Role
        </PrimaryButton>
      </div>

      {roles.length === 0 ? (
        <EmptyState title="No roles seeded yet" hint="Run supabase/seed.sql or create your first role above." />
      ) : (
      <Table head={["Role", "Dashboard Access", "App Access", "Employees", "Actions"]}>
        {roles.map((role) => (
          <tr key={role.id} className="border-b border-border last:border-0">
            <td className="px-5 py-3.5 font-semibold text-text-dark">
              {role.name} {role.is_admin && <Badge tone="info">admin</Badge>}
            </td>
            <td className="max-w-[220px] px-5 py-3.5 text-text-muted">{summarize(role.permissions, DASHBOARD_SCHEMA, "dashboard")}</td>
            <td className="max-w-[220px] px-5 py-3.5 text-text-muted">{summarize(role.permissions, APP_SCHEMA, "app")}</td>
            <td className="px-5 py-3.5 text-center text-text-muted">{employeeCounts[role.id] ?? 0}</td>
            <td className="px-5 py-3.5">
              <div className="flex items-center gap-2">
                <IconChip onClick={() => setModalRole(role)} aria-label="Edit" title="Edit">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                </IconChip>
                <DeleteButton action={deleteRoleAction} confirmText={`Delete role "${role.name}"?`} hiddenFields={{ id: role.id }} />
              </div>
            </td>
          </tr>
        ))}
      </Table>
      )}

      {modalRole && <RoleModal role={modalRole === "new" ? undefined : modalRole} onClose={() => setModalRole(null)} />}
    </div>
  );
}
