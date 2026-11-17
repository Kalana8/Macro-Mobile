"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { CheckboxSquare, FieldLabel, OutlineButton, PrimaryButton, TextInput } from "@/components/ui";
import { todayInBusinessTimezone } from "@macro/shared/datetime";
import { sortReportRows, toCsv, toPdf, toTsv, type ReportSort } from "@/lib/attendanceReport";
import { attendanceReportAction } from "./actions";

export interface ReportPerson {
  id: string;
  full_name: string;
  companyIds: string[];
}

type Scope = "all" | "companies" | "employees";
type Format = "pdf" | "csv" | "copy";

function shift(day: string, days: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday-based weeks, as on a timesheet. */
export function presets(today: string) {
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const monday = shift(today, -dow);
  return {
    today: [today, today],
    "this week": [monday, today],
    "last week": [shift(monday, -7), shift(monday, -1)],
    "this month": [`${today.slice(0, 8)}01`, today],
  } as Record<string, [string, string]>;
}

export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Builds an attendance report for everyone, chosen companies or chosen
 * employees over a date range, and downloads it as a PDF or CSV, or copies it
 * for pasting into a spreadsheet.
 */
export function ReportModal({
  companies,
  people,
  onClose,
}: {
  companies: { id: string; name: string }[];
  people: ReportPerson[];
  onClose: () => void;
}) {
  const today = todayInBusinessTimezone();
  const quick = presets(today);
  const [scope, setScope] = useState<Scope>("all");
  const [companyIds, setCompanyIds] = useState<string[]>([]);
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState(quick["this week"][0]);
  const [to, setTo] = useState(today);
  const [sort, setSort] = useState<ReportSort>("employee");
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const shownPeople = useMemo(
    () => people.filter((p) => p.full_name.toLowerCase().includes(query.trim().toLowerCase())),
    [people, query],
  );
  const list = scope === "companies" ? companies.map((c) => ({ id: c.id, label: c.name })) : shownPeople.map((p) => ({ id: p.id, label: p.full_name }));
  const chosen = scope === "companies" ? companyIds : employeeIds;
  const setChosen = scope === "companies" ? setCompanyIds : setEmployeeIds;
  const allChosen = list.length > 0 && list.every((i) => chosen.includes(i.id));

  const scopeLabel =
    scope === "all"
      ? "All employees"
      : scope === "companies"
        ? companies.filter((c) => companyIds.includes(c.id)).map((c) => c.name).join(", ")
        : employeeIds.length === 1
          ? (people.find((p) => p.id === employeeIds[0])?.full_name ?? "1 employee")
          : `${employeeIds.length} employees`;
  const period = from === to ? from : `${from} to ${to}`;

  async function run(format: Format) {
    setError(null);
    setNotice(null);
    if (scope !== "all" && chosen.length === 0) return setError(scope === "companies" ? "Choose at least one company." : "Choose at least one employee.");
    setBusy(format);
    try {
      const result = await attendanceReportAction({
        from,
        to,
        companyIds: scope === "companies" ? companyIds : undefined,
        employeeIds: scope === "employees" ? employeeIds : undefined,
      });
      if (result.error || !result.rows) return setError(result.error ?? "Couldn't build the report.");
      const rows = sortReportRows(result.rows, sort);
      if (rows.length === 0) return setError("No attendance in that period for that selection.");
      const name = `attendance-${from}${from === to ? "" : `-to-${to}`}`;
      if (format === "csv") download(new Blob([`﻿${toCsv(rows)}`], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
      else if (format === "pdf") download(await toPdf(rows, { title: "Attendance report", scope: scopeLabel, period }), `${name}.pdf`);
      else await navigator.clipboard.writeText(toTsv(rows));
      setNotice(
        `${format === "copy" ? "Copied" : "Downloaded"} ${rows.length} ${rows.length === 1 ? "shift" : "shifts"}${format === "copy" ? ". Paste into Excel or Google Sheets." : "."}${result.truncated ? " Only the first 5,000 shifts are included; narrow the dates for the rest." : ""}`,
      );
    } catch {
      setError(format === "copy" ? "Couldn't copy. Your browser may have blocked the clipboard." : "Couldn't create the report.");
    } finally {
      setBusy(null);
    }
  }

  const chip = (active: boolean) =>
    `rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold ${active ? "bg-primary text-white" : "bg-bg text-text-dark"}`;

  return (
    <Modal title="Create attendance report" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <FieldLabel>Who</FieldLabel>
          <div className="flex gap-2" role="radiogroup" aria-label="Who to include">
            {(
              [
                ["all", "All employees"],
                ["companies", "By company"],
                ["employees", "By employee"],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={scope === key} onClick={() => setScope(key)} className={chip(scope === key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {scope !== "all" && (
          <div className="flex flex-col gap-2">
            {scope === "employees" && <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employees" aria-label="Search employees" />}
            <div className="max-h-[220px] overflow-y-auto rounded-[12px] border border-border">
              {list.length === 0 ? (
                <div className="px-3.5 py-3 text-sm text-text-muted">No matches.</div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setChosen((c) => (allChosen ? c.filter((id) => !list.some((i) => i.id === id)) : [...new Set([...c, ...list.map((i) => i.id)])]))}
                    className="flex w-full items-center gap-3 border-b border-border bg-bg/60 px-3.5 py-2 text-left text-[12.5px] font-bold text-text-dark"
                  >
                    <CheckboxSquare checked={allChosen} />
                    Select all ({list.length})
                  </button>
                  {list.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      role="checkbox"
                      aria-checked={chosen.includes(i.id)}
                      onClick={() => setChosen((c) => (c.includes(i.id) ? c.filter((x) => x !== i.id) : [...c, i.id]))}
                      className="flex w-full items-center gap-3 border-b border-border px-3.5 py-2 text-left text-sm text-text-dark last:border-b-0 hover:bg-bg/50"
                    >
                      <CheckboxSquare checked={chosen.includes(i.id)} />
                      {i.label}
                    </button>
                  ))}
                </>
              )}
            </div>
            <div className="text-xs text-text-muted">{chosen.length} selected</div>
          </div>
        )}

        <div>
          <FieldLabel>Dates</FieldLabel>
          <div className="mb-2 flex flex-wrap gap-2">
            {Object.entries(quick).map(([label, [a, b]]) => (
              <button key={label} type="button" onClick={() => { setFrom(a); setTo(b); }} className={chip(from === a && to === b)}>
                {label[0].toUpperCase() + label.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <TextInput type="date" aria-label="From" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            <span className="text-text-muted">to</span>
            <TextInput type="date" aria-label="To" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div>
          <FieldLabel>Sort rows by</FieldLabel>
          <div className="flex gap-2" role="radiogroup" aria-label="Sort rows by">
            {(
              [
                ["employee", "Employee name"],
                ["company", "Company"],
                ["date", "Date"],
              ] as const
            ).map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={sort === key} onClick={() => setSort(key)} className={chip(sort === key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="text-[12.5px] text-error-text">{error}</div>}
        {notice && <div className="rounded-lg bg-olive/15 px-3.5 py-2.5 text-sm font-semibold text-olive-text">{notice}</div>}

        <div className="flex flex-wrap justify-end gap-2">
          <OutlineButton type="button" onClick={() => run("copy")} disabled={!!busy}>
            {busy === "copy" ? "Copying…" : "Copy"}
          </OutlineButton>
          <OutlineButton type="button" onClick={() => run("csv")} disabled={!!busy}>
            {busy === "csv" ? "Preparing…" : "Download CSV"}
          </OutlineButton>
          <PrimaryButton type="button" onClick={() => run("pdf")} disabled={!!busy}>
            {busy === "pdf" ? "Preparing…" : "Download PDF"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
