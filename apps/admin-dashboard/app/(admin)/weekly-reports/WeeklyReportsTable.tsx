"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, EmptyState, IconChip, PlusIcon, PrimaryButton, Select, Table, TextInput } from "@/components/ui";
import { DeleteButton } from "@/components/DeleteButton";
import { formatDate } from "@macro/shared/datetime";
import type { WeeklyReport, WeeklyReportStatus } from "@macro/shared/types";
import { deleteReportAction } from "./actions";
import { NewReportModal } from "./NewReportModal";

export interface WeeklyReportRow extends WeeklyReport {
  companyName: string;
  siteName: string | null;
  auditorName: string;
  supervisorName: string;
  sectionCount: number;
}

const STATUS_TONE: Record<WeeklyReportStatus, "neutral" | "info" | "warning" | "success"> = {
  draft: "neutral",
  in_progress: "warning",
  completed: "info",
  pdf_generated: "info",
  sent: "success",
};
const STATUS_LABEL: Record<WeeklyReportStatus, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  completed: "Completed",
  pdf_generated: "PDF Generated",
  sent: "Sent",
};
const STATUS_FILTERS: (WeeklyReportStatus | "all")[] = ["all", "draft", "in_progress", "completed", "pdf_generated", "sent"];

function OpenIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function PdfIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}

export function WeeklyReportsTable({
  reports,
  companies,
  sites,
  employees,
}: {
  reports: WeeklyReportRow[];
  companies: { id: string; name: string }[];
  sites: { id: string; name: string; company_id: string }[];
  employees: { id: string; full_name: string }[];
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("all");
  const [companyId, setCompanyId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [auditorId, setAuditorId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [weekFrom, setWeekFrom] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (companyId && r.company_id !== companyId) return false;
      if (siteId && r.site_id !== siteId) return false;
      if (auditorId && r.auditor_id !== auditorId) return false;
      if (supervisorId && r.supervisor_id !== supervisorId) return false;
      if (weekFrom && r.week_start < weekFrom) return false;
      if (q) {
        const haystack = `${r.report_number} ${r.title} ${r.companyName} ${r.siteName ?? ""} ${r.auditorName} ${r.supervisorName}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [reports, search, status, companyId, siteId, auditorId, supervisorId, weekFrom]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { draft: 0, in_progress: 0, completed: 0, sent: 0 };
    for (const r of reports) {
      if (r.status === "pdf_generated") c.completed += 1;
      else c[r.status] = (c[r.status] ?? 0) + 1;
    }
    return c;
  }, [reports]);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Draft Reports", value: counts.draft },
          { label: "In Progress", value: counts.in_progress },
          { label: "Completed Reports", value: counts.completed },
          { label: "Sent Reports", value: counts.sent },
        ].map((s) => (
          <div key={s.label} className="rounded-[14px] border border-border bg-white p-4">
            <div className="text-2xl font-extrabold text-text-dark">{s.value}</div>
            <div className="text-xs font-semibold text-text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <TextInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by report ID, title, site, auditor, supervisor…"
            className="sm:flex-1"
          />
          <PrimaryButton onClick={() => setShowNew(true)} className="sm:w-fit">
            <PlusIcon />
            Create New Report
          </PrimaryButton>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Select value={companyId} onChange={(e) => { setCompanyId(e.target.value); setSiteId(""); }}>
            <option value="">All sites/companies</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">All specific sites</option>
            {sites.filter((s) => !companyId || s.company_id === companyId).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
          <Select value={auditorId} onChange={(e) => setAuditorId(e.target.value)}>
            <option value="">All auditors</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </Select>
          <Select value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
            <option value="">All supervisors</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </Select>
          <TextInput type="date" value={weekFrom} onChange={(e) => setWeekFrom(e.target.value)} title="Week starting on/after" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No reports match" hint="Try clearing filters, or create a new report." />
      ) : (
        <Table head={["Report ID", "Week", "Site / Company", "Auditor", "Supervisor", "Sections", "Status", "Updated", "Actions"]}>
          {filtered.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="cursor-pointer px-5 py-3.5 font-semibold text-text-dark" onClick={() => router.push(`/weekly-reports/${r.id}`)}>
                {r.report_number}
                <div className="text-[11px] font-normal text-text-muted">{r.title || "Untitled"}</div>
              </td>
              <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/weekly-reports/${r.id}`)}>
                {formatDate(r.week_start, { month: "short", day: "numeric" })} – {formatDate(r.week_ending, { month: "short", day: "numeric" })}
              </td>
              <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/weekly-reports/${r.id}`)}>
                {r.siteName ? `${r.siteName} · ` : ""}{r.companyName}
              </td>
              <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/weekly-reports/${r.id}`)}>{r.auditorName}</td>
              <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/weekly-reports/${r.id}`)}>{r.supervisorName}</td>
              <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/weekly-reports/${r.id}`)}>{r.sectionCount}</td>
              <td className="cursor-pointer px-5 py-3.5" onClick={() => router.push(`/weekly-reports/${r.id}`)}>
                <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
              </td>
              <td className="cursor-pointer px-5 py-3.5 text-text-muted" onClick={() => router.push(`/weekly-reports/${r.id}`)}>
                {formatDate(r.updated_at, { month: "short", day: "numeric" })}
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <IconChip onClick={() => router.push(`/weekly-reports/${r.id}`)} aria-label="View / Edit" title="View / Edit">
                    <OpenIcon />
                  </IconChip>
                  <IconChip onClick={() => router.push(`/weekly-reports/${r.id}?action=pdf`)} aria-label="Generate PDF" title="Generate PDF">
                    <PdfIcon />
                  </IconChip>
                  <IconChip onClick={() => router.push(`/weekly-reports/${r.id}?action=share`)} aria-label="Share" title="Share">
                    <ShareIcon />
                  </IconChip>
                  <DeleteButton action={deleteReportAction} confirmText="Delete this report? This can't be undone." hiddenFields={{ id: r.id }} />
                </div>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {showNew && (
        <NewReportModal companies={companies} sites={sites} employees={employees} onClose={() => setShowNew(false)} />
      )}
    </div>
  );
}
