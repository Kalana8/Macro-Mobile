"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, CheckboxSquare, EmptyState, TextInput } from "@/components/ui";
import { statusKey, statusLabel, type SiteStatus } from "@/lib/attendanceStatus";
import { ReportModal, type ReportPerson } from "./ReportModal";
import { TimesheetBar } from "./TimesheetBar";

export interface AttendancePerson extends ReportPerson {
  job_role: string | null;
}

type View = "company" | "employee";
type Dir = "asc" | "desc";

const byName = (dir: Dir) => (a: string, b: string) => (dir === "asc" ? 1 : -1) * a.localeCompare(b, undefined, { sensitivity: "base" });

function Statuses({ list }: { list: SiteStatus[] }) {
  return (
    <>
      {list.map((s) => (
        <Badge key={s.siteId} tone={s.status === "complete" ? "success" : "warning"}>
          {list.length > 1 ? `${s.siteName}: ` : ""}
          {statusLabel(s.status)}
        </Badge>
      ))}
    </>
  );
}

/** Today's attendance, grouped by company or listed by employee, either way sorted by name. */
export function AttendanceList({
  companies,
  people,
  statuses,
}: {
  companies: { id: string; name: string }[];
  people: AttendancePerson[];
  /** Today's statuses, keyed by statusKey(employeeId, companyId). */
  statuses: Record<string, SiteStatus[]>;
}) {
  const [view, setView] = useState<View>("company");
  const [dir, setDir] = useState<Dir>("asc");
  const [query, setQuery] = useState("");
  const [reporting, setReporting] = useState(false);
  // Employees ticked for timesheets, like choosing submitted checklists to share.
  const [chosen, setChosen] = useState<string[]>([]);
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const toggleAll = (ids: string[]) => {
    const all = ids.length > 0 && ids.every((id) => chosen.includes(id));
    setChosen((c) => (all ? c.filter((id) => !ids.includes(id)) : [...new Set([...c, ...ids])]));
  };
  const selectAll = (ids: string[], label: string) => {
    const all = ids.length > 0 && ids.every((id) => chosen.includes(id));
    return (
      <button type="button" role="checkbox" aria-checked={all} aria-label={`Select all in ${label}`} onClick={() => toggleAll(ids)} className="flex items-center gap-2 text-[12.5px] font-semibold text-primary">
        <CheckboxSquare checked={all} />
        Select all
      </button>
    );
  };

  const q = query.trim().toLowerCase();
  const matches = (p: AttendancePerson) => !q || p.full_name.toLowerCase().includes(q);
  const companyName = useMemo(() => new Map(companies.map((c) => [c.id, c.name])), [companies]);
  const sortedPeople = useMemo(() => [...people].sort((a, b) => byName(dir)(a.full_name, b.full_name)), [people, dir]);
  const sortedCompanies = useMemo(() => [...companies].sort((a, b) => byName(dir)(a.name, b.name)), [companies, dir]);

  const chip = (active: boolean) =>
    `rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold ${active ? "bg-primary text-white" : "bg-white text-text-dark border border-border"}`;

  const row = (p: AttendancePerson, list: SiteStatus[], extra?: string) => (
    <div key={p.id + (extra ?? "")} className={`flex items-center gap-3 py-3 first:pt-0 last:pb-0 ${chosen.includes(p.id) ? "bg-primary/5" : ""}`}>
      <button type="button" role="checkbox" aria-checked={chosen.includes(p.id)} aria-label={`Select ${p.full_name}`} onClick={() => toggle(p.id)} className="flex shrink-0 items-center">
        <CheckboxSquare checked={chosen.includes(p.id)} />
      </button>
      <Link href={`/attendance/${p.id}`} className="flex flex-1 items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-text-dark">{p.full_name}</div>
          <div className="text-xs text-text-muted">{[p.job_role, extra].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Statuses list={list} />
          <span className="text-text-muted">→</span>
        </div>
      </Link>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-2" role="radiogroup" aria-label="Sort by">
          <button type="button" role="radio" aria-checked={view === "company"} onClick={() => setView("company")} className={chip(view === "company")}>
            By company
          </button>
          <button type="button" role="radio" aria-checked={view === "employee"} onClick={() => setView("employee")} className={chip(view === "employee")}>
            By employee name
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDir((d) => (d === "asc" ? "desc" : "asc"))}
          aria-label={dir === "asc" ? "Sorted A to Z. Switch to Z to A" : "Sorted Z to A. Switch to A to Z"}
          className={`${chip(false)} flex items-center gap-1.5 py-1`}
        >
          {/* Letters stacked top to bottom with a downward arrow beside them, like a sort icon. */}
          <span className="flex flex-col items-center text-[10.5px] font-bold leading-[1.05]" aria-hidden="true">
            <span>{dir === "asc" ? "A" : "Z"}</span>
            <span>{dir === "asc" ? "Z" : "A"}</span>
          </span>
          <svg width="12" height="22" viewBox="0 0 12 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 2v17" />
            <path d="M2 15l4 4 4-4" />
          </svg>
        </button>
        <div className="min-w-[180px] flex-1">
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employees" aria-label="Search employees" />
        </div>
        <button type="button" onClick={() => setReporting(true)} className="rounded-[11px] bg-orange px-[18px] py-2.5 text-[13.5px] font-bold text-white">
          Create report
        </button>
      </div>

      <TimesheetBar chosen={chosen} onClear={() => setChosen([])} />

      {companies.length === 0 ? (
        <EmptyState title="No companies yet" />
      ) : view === "company" ? (
        sortedCompanies.map((company) => {
          const list = sortedPeople.filter((p) => p.companyIds.includes(company.id) && matches(p));
          if (q && list.length === 0) return null;
          return (
            <Card key={company.id}>
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-[15px] font-bold text-text-dark">{company.name}</div>
                {list.length > 0 && selectAll(list.map((p) => p.id), company.name)}
              </div>
              {list.length === 0 ? (
                <div className="text-xs text-text-muted">No employees assigned to this company yet.</div>
              ) : (
                <div className="flex flex-col divide-y divide-border">{list.map((p) => row(p, statuses[statusKey(p.id, company.id)] ?? []))}</div>
              )}
            </Card>
          );
        })
      ) : (
        <Card>
          {sortedPeople.filter(matches).length > 0 && <div className="mb-3 flex justify-end">{selectAll(sortedPeople.filter(matches).map((p) => p.id), "the list")}</div>}
          {sortedPeople.filter(matches).length === 0 ? (
            <div className="text-sm text-text-muted">No employees match.</div>
          ) : (
            <div className="flex flex-col divide-y divide-border">
              {sortedPeople.filter(matches).map((p) =>
                row(
                  p,
                  p.companyIds.flatMap((c) => statuses[statusKey(p.id, c)] ?? []),
                  p.companyIds.map((c) => companyName.get(c)).filter(Boolean).join(", ") || "No company",
                ),
              )}
            </div>
          )}
        </Card>
      )}

      {reporting && <ReportModal companies={sortedCompanies} people={sortedPeople} onClose={() => setReporting(false)} />}
    </div>
  );
}
