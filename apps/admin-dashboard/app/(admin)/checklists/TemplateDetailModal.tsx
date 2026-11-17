"use client";

import { Modal } from "@/components/Modal";
import { todayInBusinessTimezone } from "@macro/shared/datetime";
import type { ChecklistTemplate } from "@macro/shared/types";
import { scheduleSummary } from "../companies/siteSchedule";
import { doneByLabel, templateDays, templateSubtaskCount } from "./templateContent";

function SectionLabel({ children }: { children: string }) {
  return <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">{children}</div>;
}

export function TemplateDetailModal({
  template,
  companyName,
  onClose,
}: {
  template: ChecklistTemplate & { site: string };
  companyName: string;
  onClose: () => void;
}) {
  const days = templateDays(template);
  const today = todayInBusinessTimezone();
  const dates = [...(template.visit_dates ?? [])].sort();
  const upcoming = dates.filter((d) => d >= today);
  const past = dates.length - upcoming.length;

  return (
    <Modal title={companyName} onClose={onClose}>
      <div className="mb-4 text-sm text-text-muted">
        {template.site} · {templateSubtaskCount(template)} subtasks · {scheduleSummary(template)}
        <div className="mt-1">
          Done by:{" "}
          <span className="font-semibold text-text-dark">
            {doneByLabel(template.day_ends_at_hour)}
          </span>
        </div>
      </div>

      {template.special_note && (
        <div className="mb-4 rounded-xl border-2 border-primary bg-primary/5 px-3.5 py-3">
          <SectionLabel>Specific Task</SectionLabel>
          <div className="text-sm text-text-dark">{template.special_note}</div>
        </div>
      )}

      {/* Date-based (older) checklists only: a 28-day cycle shows no dates, just each subtask's frequency below. */}
      {!template.cycle_start && (
      <div className="mb-4">
        <SectionLabel>Visit Dates</SectionLabel>
        {dates.length === 0 ? (
          <div className="text-sm text-text-muted">No dates set.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {upcoming.map((d) => (
              <span key={d} className="rounded-md bg-bg px-2 py-1 text-xs font-semibold text-text-dark">
                {d}
              </span>
            ))}
            {past > 0 && <span className="px-1 py-1 text-xs text-text-muted">+ {past} past</span>}
            {upcoming.length === 0 && <span className="text-xs text-text-muted">All dates have passed.</span>}
          </div>
        )}
      </div>
      )}

      {days.length === 0 && <div className="mb-4 text-sm text-text-muted">No tasks added yet.</div>}

      {days.map(({ day, label, areas }) => {
        const note = areas.find((a) => a.note)?.note;
        const images = [...new Set(areas.flatMap((a) => a.images ?? []))];
        return (
          <div key={day} className="mb-4 rounded-xl border border-border p-3.5">
            <div className="mb-2.5 text-sm font-extrabold text-primary">{label}</div>
            {areas.map((area, i) => (
              <div key={i} className="mb-3 last:mb-0">
                <div className="mb-1.5 text-[13.5px] font-bold text-text-dark">{area.main_area}</div>
                <div className="flex flex-col gap-1.5">
                  {area.subtasks.map((s) => (
                    <div key={s.id} className="rounded-lg bg-bg px-3 py-2 text-sm text-text-dark">
                      {s.text}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {note && (
              <div className="mt-3">
                <SectionLabel>Note</SectionLabel>
                <div className="text-sm text-text-dark">{note}</div>
              </div>
            )}
            {images.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {images.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="Reference" className="h-20 w-20 rounded-lg object-cover" />
                ))}
              </div>
            )}
          </div>
        );
      })}

      <button type="button" onClick={onClose} className="mt-2 w-full rounded-[12px] bg-bg py-3 text-sm font-bold text-text-dark">
        Close
      </button>
    </Modal>
  );
}
