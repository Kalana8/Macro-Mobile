"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home", label: "Home", icon: "home" },
  { href: "/attendance", label: "Attendance", icon: "clock" },
  { href: "/checklists", label: "Checklist", icon: "check" },
  { href: "/audits", label: "Audits", icon: "clipboard" },
  { href: "/communication", label: "Comms", icon: "chat" },
] as const;

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
    default:
      return null;
  }
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 flex border-t border-border bg-white px-1 pb-[max(env(safe-area-inset-bottom),8px)] pt-1.5">
      {TABS.map((tab) => {
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
