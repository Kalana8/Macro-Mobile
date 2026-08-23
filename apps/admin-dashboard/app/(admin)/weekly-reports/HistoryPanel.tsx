"use client";

import { Badge } from "@/components/ui";
import { formatDate, formatTime } from "@macro/shared/datetime";
import type { ReportPdf, ReportShare } from "@macro/shared/types";
import type { ReportWithDetail } from "./types";

function when(iso: string): string {
  return `${formatDate(iso, { month: "short", day: "numeric", year: "numeric" })} at ${formatTime(iso, { hour: "2-digit", minute: "2-digit" })}`;
}

export function HistoryPanel({
  report,
  pdfs,
  shares,
  employeeNameById,
}: {
  report: ReportWithDetail;
  pdfs: ReportPdf[];
  shares: ReportShare[];
  employeeNameById: Map<string, string>;
}) {
  const createdBy = employeeNameById.get(report.created_by) ?? "—";
  const updatedBy = report.updated_by ? (employeeNameById.get(report.updated_by) ?? "—") : "—";

  return (
    <div className="rounded-[14px] border border-border bg-white p-4">
      <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-muted">Report History</div>
      <div className="grid grid-cols-2 gap-2.5 text-[12.5px] sm:grid-cols-4">
        <div>
          <div className="text-text-muted">Created by</div>
          <div className="font-semibold text-text-dark">{createdBy}</div>
          <div className="text-[11px] text-text-muted">{when(report.created_at)}</div>
        </div>
        <div>
          <div className="text-text-muted">Last modified by</div>
          <div className="font-semibold text-text-dark">{updatedBy}</div>
          <div className="text-[11px] text-text-muted">{when(report.updated_at)}</div>
        </div>
        <div>
          <div className="text-text-muted">PDFs generated</div>
          <div className="font-semibold text-text-dark">{pdfs.length}</div>
          {pdfs[0] && <div className="text-[11px] text-text-muted">Latest: {when(pdfs[0].generated_at)}</div>}
        </div>
        <div>
          <div className="text-text-muted">Times shared</div>
          <div className="font-semibold text-text-dark">{shares.filter((s) => s.status === "sent").length}</div>
        </div>
      </div>

      {shares.length > 0 && (
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-3">
          {shares.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2 text-[12px]">
              <div>
                <span className="font-semibold text-text-dark">{s.channel === "whatsapp" ? "WhatsApp" : "Email"}</span>
                <span className="text-text-muted"> → {s.recipient}</span>
                <div className="text-[11px] text-text-muted">{when(s.sent_at)}</div>
              </div>
              <Badge tone={s.status === "sent" ? "success" : "error"}>{s.status === "sent" ? "Sent" : "Failed"}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
