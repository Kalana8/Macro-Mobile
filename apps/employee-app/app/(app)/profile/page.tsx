import Link from "next/link";
import { getCurrentEmployee } from "@/lib/session";
import { Card, ScreenHeader } from "@/components/ui";
import { LogoutButton } from "@/components/LogoutButton";

export default async function ProfilePage() {
  const session = await getCurrentEmployee();
  const employee = session?.employee;

  const rows = [
    { label: "Username", value: employee?.username ?? "—" },
    { label: "Role", value: employee?.job_role || "—" },
    { label: "Department", value: employee?.department || "—" },
    { label: "Phone", value: employee?.phone || "—" },
  ];

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

        <Card className="flex flex-col divide-y divide-border p-0">
          <button
            type="button"
            disabled
            className="px-4 py-3.5 text-left text-sm font-medium text-text-muted opacity-60"
          >
            Settings
          </button>
          <Link href="/profile/change-password" className="px-4 py-3.5 text-sm font-medium text-text-dark">
            Change Password
          </Link>
          <LogoutButton variant="menu-item" />
        </Card>
      </div>
    </div>
  );
}
