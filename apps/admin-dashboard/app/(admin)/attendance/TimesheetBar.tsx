"use client";

import { useState } from "react";
import { OutlineButton, PrimaryButton, TextInput } from "@/components/ui";
import { todayInBusinessTimezone } from "@macro/shared/datetime";
import { timesheetCsv, timesheetPdf, timesheetTsv, toTimesheets } from "@/lib/timesheet";
import { attendanceReportAction } from "./actions";
import { download, presets } from "./ReportModal";

type Format = "pdf" | "csv" | "copy";

/**
 * Timesheets for the employees ticked in the attendance list, on the page
 * itself (no popup), like sharing submitted checklists: pick a period, then
 * download a PDF or CSV, or copy them for a spreadsheet.
 */
export function TimesheetBar({ chosen, onClear }: { chosen: string[]; onClear: () => void }) {
  const today = todayInBusinessTimezone();
  const quick = presets(today);
  const [from, setFrom] = useState(quick["this week"][0]);
  const [to, setTo] = useState(today);
  const [busy, setBusy] = useState<Format | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const period = from === to ? from : `${from} to ${to}`;
  const none = chosen.length === 0;

  async function run(format: Format) {
    setError(null);
    setNotice(null);
    if (none) return setError("Tick at least one employee below.");
    setBusy(format);
    try {
      const result = await attendanceReportAction({ from, to, employeeIds: chosen });
      if (result.error || !result.rows) return setError(result.error ?? "Couldn't build the timesheets.");
      const sheets = toTimesheets(result.rows);
      if (sheets.length === 0) return setError("No shifts in that period for the selected employees.");
      const name = `timesheet-${from}${from === to ? "" : `-to-${to}`}`;
      if (format === "csv") download(new Blob([`﻿${timesheetCsv(sheets)}`], { type: "text/csv;charset=utf-8" }), `${name}.csv`);
      else if (format === "pdf") download(await timesheetPdf(sheets, period), `${name}.pdf`);
      else await navigator.clipboard.writeText(timesheetTsv(sheets));
      const missing = chosen.length - sheets.length;
      setNotice(
        `${format === "copy" ? "Copied" : "Downloaded"} ${sheets.length} ${sheets.length === 1 ? "timesheet" : "timesheets"}.` +
          (missing > 0 ? ` ${missing} selected ${missing === 1 ? "employee has" : "employees have"} no shifts in this period.` : "") +
          (format === "copy" ? " Paste into Excel or Google Sheets." : "") +
          (result.truncated ? " Only the first 5,000 shifts are included; narrow the dates for the rest." : ""),
      );
    } catch {
      setError(format === "copy" ? "Couldn't copy. Your browser may have blocked the clipboard." : "Couldn't create the timesheets.");
    } finally {
      setBusy(null);
    }
  }

  const chip = (active: boolean) =>
    `rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold ${active ? "bg-primary text-white" : "bg-white text-text-dark border border-border"}`;

  return (
    <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4" aria-label="Timesheets">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-[13px] text-text-muted">
          <span className="font-bold text-text-dark">Timesheet</span> ·{" "}
          {none ? "Tick employees below to make their timesheets." : `${chosen.length} selected`}
          {!none && (
            <button type="button" onClick={onClear} className="ml-2 font-semibold text-primary">
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <OutlineButton type="button" onClick={() => run("copy")} disabled={!!busy || none}>
            {busy === "copy" ? "Copying…" : "Copy"}
          </OutlineButton>
          <OutlineButton type="button" onClick={() => run("csv")} disabled={!!busy || none}>
            {busy === "csv" ? "Preparing…" : "Download CSV"}
          </OutlineButton>
          <PrimaryButton type="button" onClick={() => run("pdf")} disabled={!!busy || none}>
            {busy === "pdf" ? "Preparing…" : "Download PDF"}
          </PrimaryButton>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {Object.entries(quick).map(([label, [a, b]]) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              setFrom(a);
              setTo(b);
            }}
            className={chip(from === a && to === b)}
          >
            {label[0].toUpperCase() + label.slice(1)}
          </button>
        ))}
        <div className="flex items-center gap-2">
          <TextInput type="date" aria-label="From" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-text-muted">to</span>
          <TextInput type="date" aria-label="To" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      {error && <div className="text-[12.5px] text-error-text">{error}</div>}
      {notice && <div className="rounded-lg bg-olive/15 px-3.5 py-2.5 text-sm font-semibold text-olive-text">{notice}</div>}
    </div>
  );
}
