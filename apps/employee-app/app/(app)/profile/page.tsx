import { getCurrentEmployee } from "@/lib/session";
import { canViewAppArea } from "@macro/shared/rbac";
import type { AppPermissions } from "@macro/shared/types";
import { Badge, Card, ScreenHeader } from "@/components/ui";
import { LogoutButton } from "@/components/LogoutButton";

const APP_AREA_LABELS: [keyof AppPermissions, string][] = [
  ["home", "Home"],
  ["attendance", "Attendance"],
  ["checklists", "Checklists"],
  ["audits", "Audits"],
  ["communication", "Communication"],
  ["profile", "Profile"],
];

export default async function ProfilePage() {
  const session = await getCurrentEmployee();
  const employee = session?.employee;
  const permissions = session?.role?.permissions;

  const rows = [
    { label: "Username", value: employee?.username ?? "—" },
    { label: "Role", value: employee?.job_role || "—" },
    { label: "Department", value: employee?.department || "—" },
    { label: "Phone", value: employee?.phone || "—" },
  ];

  const grantedAreas = APP_AREA_LABELS.filter(([area]) => canViewAppArea(permissions, area)).map(([, label]) => label);

  return (
    <div>
      <ScreenHeader title="Profile" />
      <div className="flex flex-col gap-4 p-5">
        <Card className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
            {(employee?.full_name ?? "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-base font-bold text-text-dark">{employee?.full_name ?? "Unknown"}</div>
            <div className="text-xs text-text-muted">{employee?.job_role || "Field Employee"}</div>
          </div>
        </Card>

        <Card>
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between border-b border-border py-2.5 text-sm last:border-0">
              <span className="text-text-muted">{row.label}</span>
              <span className="font-medium text-text-dark">{row.value}</span>
            </div>
          ))}
        </Card>

        <Card>
          <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Access Role</div>
          <div className="mb-3 text-sm font-semibold text-text-dark">{session?.role?.name ?? "—"}</div>
          <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Grants Access To</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {grantedAreas.length > 0 ? (
              grantedAreas.map((label) => (
                <Badge key={label} tone="info">{label}</Badge>
              ))
            ) : (
              <span className="text-sm text-text-muted">No app access granted</span>
            )}
          </div>
        </Card>

        <Card className="flex flex-col divide-y divide-border p-0">
          <button
            type="button"
            disabled
            className="px-4 py-3.5 text-left text-sm font-medium text-text-muted opacity-60"
          >
            Settings
          </button>
          {/* TEMPORARILY REMOVED: Change Password link (feature unlinked, not deleted — see middleware.ts) */}
          <LogoutButton variant="menu-item" />
        </Card>
      </div>
    </div>
  );
}
