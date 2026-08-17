"use client";

import { forwardRef } from "react";
import type { Checklist } from "@macro/shared/types";

// Attached-image grid — 3 columns on mobile, 4 on tablet, 6 on desktop when
// shown live in the browser. Deliberately fewer/larger tiles than a typical
// thumbnail strip so each photo stays legible in the document.
const RESPONSIVE_IMAGE_GRID = "grid grid-cols-3 gap-2.5 md:grid-cols-4 lg:grid-cols-6";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-0.5 text-[13.5px] font-semibold text-text-dark">{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-3.5 w-1 rounded-full bg-primary" />
        <span className="text-[11.5px] font-bold uppercase tracking-wide text-text-dark">{title}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * A formatted "document" rendering of a submitted checklist — a report
 * layout with labeled fields and clearly separated sections, distinct from
 * the interactive admin modal (checkbox squares, app chrome). This is what
 * gets captured for the Download button and what the public share webpage
 * displays directly, so what you download/share/view always looks like a
 * finished document rather than a screenshot of the app UI.
 */
export const ChecklistDocument = forwardRef<
  HTMLDivElement,
  { checklist: Checklist; companyName: string; employeeName: string; imageGridClassName?: string }
>(function ChecklistDocument({ checklist, companyName, employeeName, imageGridClassName }, ref) {
  // The live, on-screen copy adapts columns to the viewer's own device
  // (mobile/tablet/desktop). The hidden fixed-width copy used to capture
  // the Download image passes a fixed column count instead — its container
  // width never changes, so tying it to the *capturing* device's viewport
  // would make the same download look different depending on whether it
  // was triggered from a phone or a desktop.
  const imageGrid = imageGridClassName ?? RESPONSIVE_IMAGE_GRID;
  const areaNames = checklist.areas.map((a) => a.main_area).join(", ") || "Checklist";
  const submitted = checklist.status === "submitted";
  const totalDone = checklist.areas.reduce((n, a) => n + a.subtasks.filter((t) => t.done).length, 0);
  const totalTasks = checklist.areas.reduce((n, a) => n + a.subtasks.length, 0);

  return (
    <div ref={ref} className="bg-white text-text-dark">
      <div className="h-2 bg-primary" />
      <div className="p-7">
        <div className="border-b border-border pb-5">
          <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">Checklist Report</div>
          <div className="mt-1.5 text-2xl font-extrabold">{companyName}</div>
          <div className="mt-1 text-sm text-text-muted">{areaNames}</div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 py-5 sm:grid-cols-4">
          <Field label="Site" value={checklist.site} />
          <Field label="Date" value={checklist.assigned_date} />
          <Field label="Submitted By" value={employeeName} />
          <Field label="Status" value={submitted ? "Submitted" : "Pending Review"} />
        </div>

        {checklist.special_note && (
          <div className="mb-1 rounded-xl border-2 border-primary bg-primary/5 px-4 py-3.5">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-primary">Specific Task</div>
            <div className="text-sm">{checklist.special_note}</div>
          </div>
        )}

        <div className="divide-y divide-border">
          <Section title={`Checklist Areas · ${totalDone}/${totalTasks} complete`}>
            <div className="flex flex-col gap-5">
              {checklist.areas.map((area, i) => (
                <div key={i}>
                  <div className="mb-2 text-[14px] font-bold">{area.main_area}</div>
                  <div className="flex flex-col gap-1.5">
                    {area.subtasks.map((task) => (
                      <div key={task.id} className="flex items-baseline gap-2.5 text-[13.5px]">
                        <span className={`w-4 shrink-0 text-center font-bold ${task.done ? "text-primary" : "text-text-muted"}`}>
                          {task.done ? "✓" : "○"}
                        </span>
                        <span className={task.done ? "" : "text-text-muted"}>{task.text}</span>
                      </div>
                    ))}
                  </div>
                  {area.note && <div className="mt-2 pl-[26px] text-xs italic text-text-muted">{area.note}</div>}
                  {area.images.length > 0 && (
                    <div className={`mt-3 pl-[26px] ${imageGrid}`}>
                      {area.images.map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={url}
                          src={url}
                          alt="Reference"
                          crossOrigin="anonymous"
                          className="aspect-square w-full rounded-lg border border-border object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {checklist.admin_note && (
            <Section title="Admin Note">
              <div className="text-[13.5px] leading-relaxed">{checklist.admin_note}</div>
            </Section>
          )}

          <Section title="Submitted Notes">
            {checklist.notes ? (
              <div className="text-[13.5px] leading-relaxed">{checklist.notes}</div>
            ) : (
              <div className="text-sm italic text-text-muted">No notes submitted.</div>
            )}
          </Section>

          <Section title="Submitted Images">
            {checklist.images.length === 0 ? (
              <div className="text-sm italic text-text-muted">No images submitted.</div>
            ) : (
              <div className={imageGrid}>
                {checklist.images.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={url}
                    src={url}
                    alt="Submitted"
                    crossOrigin="anonymous"
                    className="aspect-square w-full rounded-lg border border-border object-cover"
                  />
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
});
