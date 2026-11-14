import { formatDate } from "@macro/shared/datetime";
import { sortReportRows, type AttendanceReportRow } from "./attendanceReport";

/** One employee's shifts for the period, in date order, with their total. */
export interface Timesheet {
  employee: string;
  rows: AttendanceReportRow[];
  hours: number;
  /** Shifts still open (no clock-out), so not counted in the total. */
  open: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekday = (day: string) => DAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];

export function toTimesheets(rows: AttendanceReportRow[]): Timesheet[] {
  const map = new Map<string, AttendanceReportRow[]>();
  for (const r of sortReportRows(rows, "employee")) {
    const list = map.get(r.employee) ?? [];
    list.push(r);
    map.set(r.employee, list);
  }
  return [...map.entries()].map(([employee, list]) => ({
    employee,
    rows: list,
    hours: Math.round(list.reduce((t, r) => t + (r.hours ?? 0), 0) * 100) / 100,
    open: list.filter((r) => r.hours == null).length,
  }));
}

const HEADERS = ["Employee", "Date", "Day", "Company", "Site", "Start", "Finish", "Break (min)", "Hours"];

function lines(sheets: Timesheet[]): string[][] {
  const out: string[][] = [HEADERS];
  for (const s of sheets) {
    for (const r of s.rows) {
      out.push([s.employee, r.date, weekday(r.date), r.company, r.site, r.clockIn, r.clockOut, String(r.breakMinutes), r.hours == null ? "Not clocked out" : r.hours.toFixed(2)]);
    }
    out.push([s.employee, "", "", "", "", "", "", "Total", s.hours.toFixed(2)]);
  }
  return out;
}

function csvCell(v: string): string {
  // Quote, and stop spreadsheet apps from running cell text as a formula.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function timesheetCsv(sheets: Timesheet[]): string {
  return lines(sheets).map((l) => l.map(csvCell).join(",")).join("\r\n");
}

/** Tab-separated, so it pastes straight into Excel or Google Sheets as columns. */
export function timesheetTsv(sheets: Timesheet[]): string {
  return lines(sheets).map((l) => l.map((c) => c.replace(/[\t\n]/g, " ")).join("\t")).join("\n");
}

/** One page (or more) per employee, with a total and sign-off lines, ready to print. */
export async function timesheetPdf(sheets: Timesheet[], period: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  const H = 297;
  const M = 14;
  const cols = [24, 12, 34, 38, 16, 16, 14, 18]; // Date, Day, Company, Site, Start, Finish, Break, Hours
  const scale = (W - 2 * M) / cols.reduce((a, b) => a + b, 0);
  const widths = cols.map((w) => w * scale);
  const heads = HEADERS.slice(1);
  const generated = formatDate(new Date(), { day: "numeric", month: "short", year: "numeric" });
  let y = M;

  const tableHeader = () => {
    doc.setFillColor(3, 69, 129);
    doc.rect(M, y, W - 2 * M, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    let x = M;
    heads.forEach((h, i) => {
      doc.text(h, i === heads.length - 1 ? x + widths[i] - 1.5 : x + 1.5, y + 4.7, i === heads.length - 1 ? { align: "right" } : undefined);
      x += widths[i];
    });
    y += 7;
    doc.setTextColor(22, 32, 46);
    doc.setFont("helvetica", "normal");
  };

  const title = (s: Timesheet, cont: boolean) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(3, 69, 129);
    doc.text("Timesheet", M, y + 5);
    doc.setFontSize(12);
    doc.setTextColor(22, 32, 46);
    doc.text(`${s.employee}${cont ? " (continued)" : ""}`, M, y + 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(110, 120, 135);
    doc.text(`${period} · Generated ${generated}`, M, y + 17.5);
    y += 23;
    tableHeader();
  };

  sheets.forEach((s, n) => {
    if (n > 0) doc.addPage();
    y = M;
    title(s, false);
    s.rows.forEach((r, i) => {
      if (y > H - 50) {
        doc.addPage();
        y = M;
        title(s, true);
      }
      if (i % 2 === 0) {
        doc.setFillColor(245, 247, 250);
        doc.rect(M, y, W - 2 * M, 6.5, "F");
      }
      doc.setFontSize(8.5);
      const cells = [r.date, weekday(r.date), r.company, r.site, r.clockIn, r.clockOut, String(r.breakMinutes), r.hours == null ? "Open" : r.hours.toFixed(2)];
      let x = M;
      cells.forEach((c, k) => {
        const fitted = doc.splitTextToSize(c, widths[k] - 2)[0] ?? "";
        if (k === cells.length - 1) doc.text(fitted, x + widths[k] - 1.5, y + 4.5, { align: "right" });
        else doc.text(fitted, x + 1.5, y + 4.5);
        x += widths[k];
      });
      y += 6.5;
    });

    doc.setDrawColor(3, 69, 129);
    doc.setLineWidth(0.4);
    doc.line(M, y + 1, W - M, y + 1);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Total: ${s.rows.length} ${s.rows.length === 1 ? "shift" : "shifts"}, ${s.hours.toFixed(2)} hours`, W - M - 1.5, y + 7, { align: "right" });
    doc.setFont("helvetica", "normal");
    if (s.open) {
      doc.setFontSize(8);
      doc.setTextColor(110, 120, 135);
      doc.text(`${s.open} ${s.open === 1 ? "shift has" : "shifts have"} no clock-out yet and ${s.open === 1 ? "is" : "are"} not counted.`, W - M - 1.5, y + 12, { align: "right" });
      doc.setTextColor(22, 32, 46);
    }

    const sy = Math.max(y + 26, H - 40);
    doc.setDrawColor(150, 160, 175);
    doc.setLineWidth(0.2);
    doc.setFontSize(8.5);
    doc.line(M, sy, M + 75, sy);
    doc.line(W - M - 75, sy, W - M, sy);
    doc.text("Employee signature / date", M, sy + 4.5);
    doc.text("Approved by / date", W - M - 75, sy + 4.5);
  });

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(110, 120, 135);
    doc.text(`Macro Property Services · Page ${p} of ${pages}`, W - M, H - 6, { align: "right" });
  }
  return doc.output("blob");
}
