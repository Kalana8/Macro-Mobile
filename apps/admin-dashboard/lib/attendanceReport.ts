import { businessDayOf, formatDate, formatTime } from "@macro/shared/datetime";

/** One shift, flattened for the attendance report. */
export interface AttendanceReportRow {
  date: string; // YYYY-MM-DD, business day of clock-in
  employee: string;
  company: string;
  site: string;
  clockIn: string;
  clockOut: string;
  breakMinutes: number;
  hours: number | null;
  status: string;
  location: string;
}

export interface RawAttendance {
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_break_minutes: number | null;
  status: string;
  geo_verified: boolean | null;
  clock_out_geo_verified: boolean | null;
  employees: { full_name?: string } | { full_name?: string }[] | null;
  companies: { name?: string } | { name?: string }[] | null;
  sites: { name?: string } | { name?: string }[] | null;
}

export type ReportSort = "employee" | "company" | "date";

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
const time = (iso: string | null) => (iso ? formatTime(iso, { hour: "2-digit", minute: "2-digit" }) : "");
const statusText: Record<string, string> = { clocked_in: "Clocked in", on_break: "On break", complete: "Clocked out" };

export function toReportRows(raw: RawAttendance[]): AttendanceReportRow[] {
  return raw
    .filter((r) => r.clock_in_at)
    .map((r) => {
      const breakMinutes = r.total_break_minutes ?? 0;
      const hours =
        r.clock_in_at && r.clock_out_at
          ? Math.max(0, (new Date(r.clock_out_at).getTime() - new Date(r.clock_in_at).getTime()) / 3600000 - breakMinutes / 60)
          : null;
      const location = [
        r.geo_verified === false ? "In: mismatch" : "In: verified",
        r.clock_out_at ? (r.clock_out_geo_verified === false ? "Out: mismatch" : "Out: verified") : null,
      ]
        .filter(Boolean)
        .join(", ");
      return {
        date: businessDayOf(r.clock_in_at!),
        employee: one(r.employees)?.full_name ?? "—",
        company: one(r.companies)?.name ?? "—",
        site: one(r.sites)?.name ?? "—",
        clockIn: time(r.clock_in_at),
        clockOut: time(r.clock_out_at),
        breakMinutes,
        hours: hours == null ? null : Math.round(hours * 100) / 100,
        status: statusText[r.status] ?? r.status,
        location,
      };
    });
}

export function sortReportRows(rows: AttendanceReportRow[], by: ReportSort): AttendanceReportRow[] {
  const keys: Record<ReportSort, (r: AttendanceReportRow) => string[]> = {
    employee: (r) => [r.employee, r.date, r.clockIn],
    company: (r) => [r.company, r.employee, r.date, r.clockIn],
    date: (r) => [r.date, r.employee, r.clockIn],
  };
  return [...rows].sort((a, b) => {
    const ka = keys[by](a);
    const kb = keys[by](b);
    for (let i = 0; i < ka.length; i++) {
      const c = ka[i].localeCompare(kb[i], undefined, { sensitivity: "base" });
      if (c) return c;
    }
    return 0;
  });
}

const HEADERS = ["Date", "Employee", "Company", "Site", "Clock in", "Clock out", "Break (min)", "Hours", "Status", "Location"];

function cells(r: AttendanceReportRow): string[] {
  return [r.date, r.employee, r.company, r.site, r.clockIn, r.clockOut, String(r.breakMinutes), r.hours == null ? "" : r.hours.toFixed(2), r.status, r.location];
}

/** Total worked hours per employee, for the summary at the end of the report. */
export function totalsByEmployee(rows: AttendanceReportRow[]): { employee: string; shifts: number; hours: number }[] {
  const map = new Map<string, { shifts: number; hours: number }>();
  for (const r of rows) {
    const t = map.get(r.employee) ?? { shifts: 0, hours: 0 };
    t.shifts += 1;
    t.hours += r.hours ?? 0;
    map.set(r.employee, t);
  }
  return [...map.entries()].map(([employee, t]) => ({ employee, ...t })).sort((a, b) => a.employee.localeCompare(b.employee));
}

function csvCell(v: string): string {
  // Quote, and stop spreadsheet apps from running cell text as a formula.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(rows: AttendanceReportRow[]): string {
  return [HEADERS, ...rows.map(cells)].map((line) => line.map(csvCell).join(",")).join("\r\n");
}

/** Tab-separated, so it pastes straight into Excel or Google Sheets as columns. */
export function toTsv(rows: AttendanceReportRow[]): string {
  return [HEADERS, ...rows.map(cells)].map((line) => line.map((c) => c.replace(/[\t\n]/g, " ")).join("\t")).join("\n");
}

export async function toPdf(rows: AttendanceReportRow[], meta: { title: string; scope: string; period: string }): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = 297;
  const M = 10;
  const widths = [20, 38, 34, 34, 16, 16, 16, 14, 22, 50]; // sums to 260 + gaps below
  const scale = (W - 2 * M) / widths.reduce((a, b) => a + b, 0);
  const cols = widths.map((w) => w * scale);
  let y = M;

  const header = () => {
    doc.setFillColor(3, 69, 129);
    doc.rect(M, y, W - 2 * M, 7, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    let x = M;
    HEADERS.forEach((h, i) => {
      doc.text(h, x + 1.5, y + 4.7);
      x += cols[i];
    });
    y += 7;
    doc.setTextColor(22, 32, 46);
    doc.setFont("helvetica", "normal");
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(3, 69, 129);
  doc.text(meta.title, M, y + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(110, 120, 135);
  doc.text(`${meta.period} · ${meta.scope} · ${rows.length} shifts · Generated ${formatDate(new Date(), { day: "numeric", month: "short", year: "numeric" })}`, M, y + 11);
  y += 16;
  header();

  rows.forEach((r, n) => {
    if (y > 200 - M) {
      doc.addPage();
      y = M;
      header();
    }
    if (n % 2 === 0) {
      doc.setFillColor(245, 247, 250);
      doc.rect(M, y, W - 2 * M, 6, "F");
    }
    doc.setFontSize(7.5);
    let x = M;
    cells(r).forEach((c, i) => {
      const fitted = doc.splitTextToSize(c, cols[i] - 2)[0] ?? "";
      if (i === 9 && c.includes("mismatch")) doc.setTextColor(179, 38, 30);
      doc.text(fitted, x + 1.5, y + 4.2);
      doc.setTextColor(22, 32, 46);
      x += cols[i];
    });
    y += 6;
  });

  const totals = totalsByEmployee(rows);
  if (totals.length) {
    if (y > 180 - M) {
      doc.addPage();
      y = M;
    }
    y += 6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Totals by employee", M, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    for (const t of totals) {
      if (y > 200 - M) {
        doc.addPage();
        y = M;
      }
      doc.text(`${t.employee}: ${t.shifts} ${t.shifts === 1 ? "shift" : "shifts"}, ${t.hours.toFixed(2)} hours`, M, y);
      y += 4.5;
    }
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(110, 120, 135);
    doc.text(`Macro Property Services · Page ${p} of ${pages}`, W - M, 210 - 5, { align: "right" });
  }
  return doc.output("blob");
}
