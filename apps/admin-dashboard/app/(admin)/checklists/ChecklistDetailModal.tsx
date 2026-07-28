"use client";

import { Modal } from "@/components/Modal";
import { Badge } from "@/components/ui";
import type { Checklist } from "@macro/shared/types";

export function ChecklistDetailModal({
  checklist,
  companyName,
  employeeName,
  onClose,
}: {
  checklist: Checklist;
  companyName: string;
  employeeName: string;
  onClose: () => void;
}) {
  const areaNames = checklist.areas.map((a) => a.main_area).join(", ") || "Checklist";
  const submitted = checklist.status === "submitted";

  return (
    <Modal title={areaNames} onClose={onClose}>
      <div className="mb-1 text-xs text-text-muted">{checklist.assigned_date} · {companyName}</div>
      <div className="mb-5 flex items-center justify-between text-sm text-text-muted">
        <span>{employeeName} · {checklist.site}</span>
        <Badge tone={submitted ? "success" : "warning"}>{submitted ? "Submitted" : "Pending Review"}</Badge>
      </div>

      {checklist.areas.map((area, i) => (
        <div key={i} className="mb-4">
          <div className="mb-2 text-[13.5px] font-bold text-text-dark">{area.main_area}</div>
          <div className="flex flex-col gap-2">
            {area.subtasks.map((task) => (
              <div key={task.id} className="flex items-center gap-2.5">
                <span
                  className={`h-[18px] w-[18px] shrink-0 rounded-[5px] border-2 ${
                    task.done ? "border-primary bg-primary" : "border-border bg-white"
                  }`}
                />
                <span className="text-[13.5px] text-text-dark">{task.text}</span>
              </div>
            ))}
          </div>
          {area.images.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {area.images.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={url} src={url} alt="Reference" className="h-14 w-14 rounded-lg object-cover" />
              ))}
            </div>
          )}
        </div>
      ))}

      {checklist.admin_note && (
        <>
          <div className="mb-1.5 text-xs font-bold text-text-muted">ADMIN NOTE</div>
          <div className="mb-4 rounded-xl bg-bg px-3.5 py-3 text-sm text-text-dark">{checklist.admin_note}</div>
        </>
      )}

      <div className="mb-2 text-xs font-bold text-text-muted">SUBMITTED NOTES</div>
      {checklist.notes ? (
        <div className="mb-5 rounded-xl bg-bg px-4 py-3.5 text-[13.5px] leading-relaxed text-text-dark">{checklist.notes}</div>
      ) : (
        <div className="mb-5 rounded-xl bg-bg px-4 py-3.5 text-sm italic text-text-muted">No notes submitted yet.</div>
      )}

      <div className="mb-2 text-xs font-bold text-text-muted">SUBMITTED IMAGES</div>
      <div className="mb-4 flex flex-wrap gap-2.5">
        {checklist.images.length === 0 ? (
          <div className="text-sm italic text-text-muted">No images submitted yet.</div>
        ) : (
          checklist.images.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="Submitted" className="h-[72px] w-[72px] rounded-xl object-cover" />
          ))
        )}
      </div>

      <button type="button" onClick={onClose} className="w-full rounded-[12px] bg-bg py-3 text-sm font-bold text-text-dark">
        Close
      </button>
    </Modal>
  );
}
