import Link from "next/link";

const TABS = [
  { key: "templates", label: "Assignments", href: "/inductions/templates" },
  { key: "invitations", label: "Invitations", href: "/inductions" },
  { key: "submissions", label: "Submitted Forms", href: "/inductions/submissions" },
  { key: "results", label: "Assessment Results", href: "/inductions/results" },
  { key: "certificates", label: "Certificates", href: "/inductions/certificates" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/** The two parts of "Induction and Check Links": Inductions and Checks. */
export function PartSwitch({ active }: { active: "inductions" | "checks" }) {
  const parts = [
    { key: "inductions", label: "Inductions", href: "/inductions" },
    { key: "checks", label: "Checks", href: "/inductions/checks" },
  ] as const;
  return (
    <div className="mb-3 flex w-fit gap-1 rounded-[12px] border border-border bg-white p-1" role="tablist" aria-label="Induction and Check Links">
      {parts.map((p) => (
        <Link
          key={p.key}
          href={p.href}
          role="tab"
          aria-selected={active === p.key}
          className={`rounded-[9px] px-5 py-2 text-sm font-extrabold ${active === p.key ? "bg-primary text-white" : "text-text-muted"}`}
        >
          {p.label}
        </Link>
      ))}
    </div>
  );
}

export function InductionTabs({ active }: { active: TabKey }) {
  return (
    <>
      <PartSwitch active="inductions" />
      <div className="mb-4 flex w-fit flex-wrap gap-1.5 rounded-lg bg-bg p-1">
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
    </>
  );
}
