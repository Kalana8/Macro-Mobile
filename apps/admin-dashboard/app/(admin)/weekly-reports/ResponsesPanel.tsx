"use client";

import { Badge } from "@/components/ui";
import { formatDate, formatTime } from "@macro/shared/datetime";
import type { ReportRecipient } from "./ShareModal";

const when = (iso: string) => `${formatDate(iso, { month: "short", day: "numeric", year: "numeric" })} at ${formatTime(iso, { hour: "2-digit", minute: "2-digit" })}`;

/**
 * Who the report was shared with in the app, and what they did: opened it,
 * pressed Verified, or submitted a note and photos (Submitted).
 */
export function ResponsesPanel({
  recipients,
  employeeNameById,
  photoUrls,
}: {
  recipients: ReportRecipient[];
  employeeNameById: Map<string, string>;
  photoUrls: Record<string, string>;
}) {
  if (recipients.length === 0) return null;
  const order = (r: ReportRecipient) => (r.submitted_at ? 0 : r.verified_at ? 1 : 2);
  const list = [...recipients].sort((a, b) => order(a) - order(b));

  return (
    <div className="rounded-[16px] border border-border bg-white p-4">
      <div className="mb-3 text-[13px] font-bold text-text-dark">App responses</div>
      <div className="flex flex-col divide-y divide-border">
        {list.map((r) => {
          const images = r.response_images ?? [];
          return (
            <div key={r.employee_id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-semibold text-text-dark">{employeeNameById.get(r.employee_id) ?? "Someone"}</div>
                <Badge tone={r.submitted_at ? "info" : r.verified_at ? "success" : r.seen_at ? "neutral" : "warning"}>
                  {r.submitted_at ? "Submitted" : r.verified_at ? "Verified" : r.seen_at ? "Opened" : "Sent"}
                </Badge>
              </div>
              <div className="mt-0.5 text-xs text-text-muted">
                {r.submitted_at ? `Submitted ${when(r.submitted_at)}` : r.verified_at ? `Verified ${when(r.verified_at)}` : `Shared ${when(r.shared_at)}`}
              </div>
              {r.submitted_at && r.response_note ? <p className="mt-2 whitespace-pre-wrap rounded-lg bg-bg px-3 py-2 text-sm text-text-dark">{r.response_note}</p> : null}
              {r.submitted_at && images.length > 0 && (
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {images.map((p, i) =>
                    photoUrls[p] ? (
                      <a key={p} href={photoUrls[p]} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
                        {/* eslint-disable-next-line @next/next/no-img-element -- signed private storage link, not a static asset */}
                        <img src={photoUrls[p]} alt={`Photo ${i + 1} from ${employeeNameById.get(r.employee_id) ?? "the employee"}`} className="aspect-square w-full object-cover" />
                      </a>
                    ) : (
                      <div key={p} className="aspect-square rounded-lg bg-bg" />
                    ),
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
