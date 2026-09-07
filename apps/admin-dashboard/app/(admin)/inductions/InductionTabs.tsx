import Link from "next/link";

const TABS = [
  { key: "templates", label: "Assignments", href: "/inductions/templates" },
  { key: "invitations", label: "Invitations", href: "/inductions" },
  { key: "submissions", label: "Submitted Forms", href: "/inductions/submissions" },
] as const;

export function InductionTabs({ active }: { active: "invitations" | "templates" | "submissions" }) {
  return (
    <div className="mb-4 flex w-fit gap-1.5 rounded-lg bg-bg p-1">
      {TABS.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`rounded-md px-4 py-2 text-sm font-bold ${
            active === tab.key ? "bg-white text-primary shadow-sm" : "text-text-muted"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
