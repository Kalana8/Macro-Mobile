"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { canViewAppArea } from "@macro/shared/rbac";
import type { RolePermissions } from "@macro/shared/types";

const TABS = [
  { href: "/home", label: "Home", icon: "home", area: "home" as const },
  { href: "/attendance", label: "Attendance", icon: "clock", area: "attendance" as const },
  { href: "/checklists", label: "Checklist", icon: "check", area: "checklists" as const },
  { href: "/audits", label: "Audits", icon: "clipboard", area: "audits" as const },
  { href: "/communication", label: "Comms", icon: "chat", area: "communication" as const },
] as const;

// Not permission-filtered like the tabs above — Profile is where Log Out
// lives, and every signed-in account needs a way to log out regardless of
// which feature areas their role grants.
const PROFILE_TAB = { href: "/profile", label: "Profile", icon: "person" } as const;

function Icon({ name, active }: { name: string; active: boolean }) {
  const color = active ? "#0E62D1" : "#6E7887";
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "home":
      return <svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>;
    case "check":
      return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8 12 3 3 5-6" /></svg>;
    case "clipboard":
      return <svg {...common}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 3h6v3H9z" /></svg>;
    case "chat":
      return <svg {...common}><path d="M4 5h16v11H8l-4 4V5Z" /></svg>;
    case "person":
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" /></svg>;
    default:
      return null;
  }
}

export function BottomNav({ permissions }: { permissions: RolePermissions | null }) {
  const pathname = usePathname();
  const tabs = [...TABS.filter((tab) => canViewAppArea(permissions, tab.area)), PROFILE_TAB];

  return (
    <nav className="sticky bottom-0 z-20 flex border-t border-primary/20 bg-primary/15 px-1 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-1 flex-col items-center gap-0.5 py-1.5"
          >
            <Icon name={tab.icon} active={active} />
            <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-text-muted"}`}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
