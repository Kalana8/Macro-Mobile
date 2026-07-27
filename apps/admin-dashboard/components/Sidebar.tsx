"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RolePermissions } from "@macro/shared/types";
import { canViewDashboardArea } from "@macro/shared/rbac";

function NavIcon({ name }: { name: string }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" />
          <rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" />
        </svg>
      );
    case "companies":
      return (
        <svg {...common}>
          <rect x="4" y="3" width="16" height="18" rx="1" />
          <path d="M9 7h1M14 7h1M9 11h1M14 11h1M9 15h1M14 15h1" />
        </svg>
      );
    case "employees":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" /><path d="M2.5 19c1-3.5 4-5.2 6.5-5.2s5.5 1.7 6.5 5.2" />
          <circle cx="18" cy="8.5" r="2.4" /><path d="M16 13.6c2 .2 3.8 1.5 4.5 4" />
        </svg>
      );
    case "attendance":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
        </svg>
      );
    case "audits":
      return (
        <svg {...common}>
          <rect x="6" y="4" width="12" height="16" rx="2" />
          <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
          <path d="M9 10h6M9 14h6M9 18h3" />
        </svg>
      );
    case "checklists":
      return (
        <svg {...common}>
          <path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="M3 12l9 5 9-5" /><path d="M3 16l9 5 9-5" />
        </svg>
      );
    case "roles":
      return (
        <svg {...common}>
          <rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
      );
    case "communication":
      return (
        <svg {...common}>
          <path d="M4 5h16v11H8l-4 4V5Z" />
        </svg>
      );
    default:
      return null;
  }
}

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard", area: "dashboard" as const },
  { href: "/companies", label: "Companies", icon: "companies", area: "companies" as const },
  { href: "/employees", label: "Employees", icon: "employees", area: "employees" as const },
  { href: "/attendance", label: "Attendance", icon: "attendance", area: "attendance" as const },
  { href: "/audits", label: "Audits", icon: "audits", area: "audits" as const },
  { href: "/checklists", label: "Checklists", icon: "checklists", area: "checklists" as const },
  { href: "/communication", label: "Communication", icon: "communication", area: "communication" as const },
  { href: "/roles-access", label: "Roles & Access", icon: "roles", area: "roles" as const },
];

export function Sidebar({
  permissions,
  onLogout,
}: {
  permissions: RolePermissions | null;
  onLogout: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-border bg-white px-4 py-6">
      <div className="mb-7 flex justify-center">
        <Image src="/uploads/footer.webp" alt="MACRO" width={140} height={52} className="h-[52px] w-auto" />
      </div>
      <div className="px-2.5 pb-2 text-[11px] font-bold tracking-wide text-text-muted">ADMIN CONSOLE</div>
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.filter((item) => canViewDashboardArea(permissions, item.area)).map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-sm font-semibold ${
                active ? "bg-primary/10 text-primary" : "text-text-dark hover:bg-bg"
              }`}
            >
              <NavIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1" />
      <form action={onLogout}>
        <button
          type="submit"
          className="flex w-full items-center gap-2.5 rounded-[11px] px-3 py-2.5 text-left text-[13.5px] font-semibold text-text-muted"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
            <path d="M10 12h10" />
            <path d="M17 8l4 4-4 4" />
          </svg>
          Log Out
        </button>
      </form>
    </aside>
  );
}
