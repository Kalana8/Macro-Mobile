"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { ImagePicker } from "@/components/ImagePicker";
import { FieldLabel, PrimaryButton, Select, TextInput } from "@/components/ui";
import type { ChecklistTemplate, Site } from "@macro/shared/types";
import { VisitScheduleFields } from "../companies/VisitScheduleFields";
import { createTemplateAction, uploadChecklistImageAction, type ChecklistFormState } from "./actions";

interface DraftArea {
  mainArea: string;
  note: string;
  subtasks: string[];
  images: string[];
}

const EMPTY_AREA: DraftArea = { mainArea: "", note: "", subtasks: [""], images: [] };
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDraftAreas(areas: { main_area: string; note: string; subtasks: { text: string }[]; images?: string[] }[]): DraftArea[] {
  return areas.map((a) => ({
    mainArea: a.main_area,
    note: a.note,
    subtasks: a.subtasks.map((s) => s.text),
    images: a.images ?? [],
  }));
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const result = await uploadChecklistImageAction(formData);
  if (result.error || !result.url) throw new Error(result.error ?? "Upload failed.");
  return result.url;
}

function SubmitButton({ label, onClick }: { label: string; onClick: () => void }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending} onClick={onClick}>
      {pending ? "Saving…" : label}
    </PrimaryButton>
  );
}

function SaveDayButton({ label, onClick }: { label: string; onClick: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      onClick={onClick}
      className="w-fit rounded-[11px] bg-primary px-4 py-2 text-[12.5px] font-bold text-white disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

export function CreateTemplateModal({
  companies,
  sites,
  template,
  onClose,
}: {
  companies: { id: string; name: string }[];
  sites: Site[];
  template?: ChecklistTemplate;
  onClose: () => void;
}) {
  const isEdit = Boolean(template);
  const [state, formAction] = useActionState<ChecklistFormState, FormData>(createTemplateAction, {});

  // Every selected day gets its own independent checklist content, and
  // repeats every week on that day until the schedule is ended.
  const [dayAreas, setDayAreas] = useState<Record<number, DraftArea[]>>(() => {
    const initial: Record<number, DraftArea[]> = {};
    if (template?.day_areas) {
      for (const [day, areas] of Object.entries(template.day_areas)) {
        initial[Number(day)] = toDraftAreas(areas);
      }
    }
    return initial;
  });

  // Two rows can share a company name (a known data quirk) — collapse to
  // one entry per name so the picker doesn't show apparent duplicates.
  const uniqueCompanies = useMemo(() => {
    const seen = new Set<string>();
    return companies.filter((c) => {
      const key = c.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [companies]);
  const [companyId, setCompanyId] = useState(template?.company_id ?? uniqueCompanies[0]?.id ?? "");
  const siteOptions = useMemo(() => sites.filter((s) => s.company_id === companyId), [sites, companyId]);
  const [siteId, setSiteId] = useState(template?.site_id ?? "");
  const [specialNote, setSpecialNote] = useState(template?.special_note ?? "");

  const [visitDates, setVisitDates] = useState<string[]>(template?.visit_dates ?? []);
  // Which weekdays are represented among the picked dates — content is
  // edited once per weekday, and every date that falls on it reuses the
  // same content automatically.
  const selectedWeekdays = useMemo(() => {
    const set = new Set<number>();
    for (const iso of visitDates) set.add(new Date(`${iso}T00:00:00`).getDay());
    return [...set].sort();
  }, [visitDates]);
  const [activeDay, setActiveDay] = useState<number | null>(selectedWeekdays[0] ?? null);

  // One shared note + one shared set of photos per day — applies to the
  // whole day's checklist rather than being repeated under every main area.
  const [dayNotes, setDayNotes] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    if (template?.day_areas) {
      for (const [day, areas] of Object.entries(template.day_areas)) {
        initial[Number(day)] = areas[0]?.note ?? "";
      }
    }
    return initial;
  });
  const [dayImages, setDayImages] = useState<Record<number, string[]>>(() => {
    const initial: Record<number, string[]> = {};
    if (template?.day_areas) {
      for (const [day, areas] of Object.entries(template.day_areas)) {
        initial[Number(day)] = areas[0]?.images ?? [];
      }
    }
    return initial;
  });

  // A day starts "saved" if it already had content when the template was
  // loaded for editing. Saving a day (via its own Save button) adds it here
  // and switches it to a read-only view; Edit takes it back out.
  const [savedDays, setSavedDays] = useState<Set<number>>(
    () => new Set(Object.keys(template?.day_areas ?? {}).map(Number))
  );
  const [editingDays, setEditingDays] = useState<Set<number>>(new Set());
  const saveIntentRef = useRef<"day" | "final">("final");

  // A brand-new day starts as a copy of another day's content (if any day
  // already has some) instead of blank — saves retyping when several days
  // share mostly the same checklist. From here on each day is independent:
  // editing/saving one doesn't touch any other.
  function ensureDay(day: number) {
    setDayAreas((prev) => {
      if (prev[day]) return prev;
      const sourceDay = Object.keys(prev).find((d) => prev[Number(d)].some((a) => a.mainArea.trim()));
      if (sourceDay !== undefined) {
        const sourceNum = Number(sourceDay);
        setDayNotes((n) => (n[day] !== undefined ? n : { ...n, [day]: dayNotes[sourceNum] ?? "" }));
        setDayImages((im) => (im[day] !== undefined ? im : { ...im, [day]: [...(dayImages[sourceNum] ?? [])] }));
      }
      const seed = sourceDay !== undefined
        ? prev[Number(sourceDay)].map((a) => ({ ...a, subtasks: [...a.subtasks], images: [] }))
        : [EMPTY_AREA];
      return { ...prev, [day]: seed };
    });
  }

  function handleSelectDay(day: number) {
    ensureDay(day);
    setActiveDay(day);
  }

  // Keep the active tab in sync with which weekdays are still represented —
  // if the admin removes every date on the weekday they were editing, fall
  // back to another represented weekday (initializing it if it's brand new)
  // instead of pointing at a weekday no longer part of the schedule.
  function handleDatesChange(dates: string[]) {
    setVisitDates(dates);
    const weekdays = [...new Set(dates.map((iso) => new Date(`${iso}T00:00:00`).getDay()))].sort();
    if (activeDay !== null && weekdays.includes(activeDay)) return;
    const next = weekdays[0] ?? null;
    setActiveDay(next);
    if (next !== null) ensureDay(next);
  }

  const currentAreas = activeDay !== null ? dayAreas[activeDay] ?? [] : [];
  const isDayViewMode = activeDay !== null && savedDays.has(activeDay) && !editingDays.has(activeDay);

  function setCurrentAreas(updater: (prev: DraftArea[]) => DraftArea[]) {
    if (activeDay === null) return;
    setDayAreas((prev) => ({ ...prev, [activeDay]: updater(prev[activeDay] ?? []) }));
  }

  useEffect(() => {
    if (!state.success) return;
    if (saveIntentRef.current === "final") {
      onClose();
      return;
    }
    if (activeDay !== null) {
      setSavedDays((prev) => new Set(prev).add(activeDay));
      setEditingDays((prev) => {
        const next = new Set(prev);
        next.delete(activeDay);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function updateArea(i: number, patch: Partial<DraftArea>) {
    setCurrentAreas((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }
  function updateSubtask(ai: number, si: number, text: string) {
    setCurrentAreas((prev) =>
      prev.map((a, idx) => (idx === ai ? { ...a, subtasks: a.subtasks.map((s, sIdx) => (sIdx === si ? text : s)) } : a))
    );
  }

  const dayAreasPayload = Object.fromEntries(
    selectedWeekdays
      .map((d) => {
        const areas = (dayAreas[d] ?? []).map((a) => ({
          ...a,
          note: dayNotes[d] ?? "",
          images: dayImages[d] ?? [],
        }));
        return [d, areas];
      })
      .filter(([, a]) => (a as DraftArea[]).length > 0)
  );

  return (
    <Modal title={isEdit ? "Edit Checklist Template" : "Create Checklist Template"} onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        {isEdit && <input type="hidden" name="templateId" value={template!.id} />}
        <input type="hidden" name="dayAreasJson" value={JSON.stringify(dayAreasPayload)} />
        <input type="hidden" name="siteId" value={siteId} />
        <input type="hidden" name="specialNote" value={specialNote} />
        <div>
          <FieldLabel>Company</FieldLabel>
          <Select
            name="companyId"
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setSiteId("");
            }}
          >
            {uniqueCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Site</FieldLabel>
          <Select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">{siteOptions.length === 0 ? "No sites for this company" : "Select a site"}</option>
            {siteOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </Select>
        </div>

        <VisitScheduleFields dates={visitDates} onDatesChange={handleDatesChange} />

        {visitDates.length > 0 && (
          <div>
            <FieldLabel>Special Notes</FieldLabel>
            <p className="mb-1.5 -mt-1 text-[11px] text-text-muted">
              Sent with the checklist and shown to the employee as a highlighted Specific Task, separate from the
              areas below.
            </p>
            <textarea
              value={specialNote}
              onChange={(e) => setSpecialNote(e.target.value)}
              placeholder="e.g. Client requested extra attention to the loading dock for this visit"
              rows={3}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
            />
          </div>
        )}

        <div>
          <FieldLabel>Checklist Content For</FieldLabel>
          {selectedWeekdays.length === 0 ? (
            <p className="text-[12.5px] text-text-muted">Select at least one date above to add its checklist content.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {selectedWeekdays.map((day) => {
                const hasContent = (dayAreas[day] ?? []).some((a) => a.mainArea.trim());
                const active = activeDay === day;
                return (
                  <button
                    type="button"
                    key={day}
                    onClick={() => handleSelectDay(day)}
                    className={`relative rounded-lg px-3.5 py-2 text-[12.5px] font-bold ${
                      active ? "bg-primary text-white" : "bg-bg text-text-dark"
                    }`}
                  >
                    {DAY_LABELS[day]}
                    {hasContent && (
                      <span
                        className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${active ? "bg-white" : "bg-primary"}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {activeDay !== null && (
          <>
            {currentAreas.map((area, ai) => (
              <div key={ai} className="rounded-[14px] border border-border bg-bg p-3.5">
                <div className="mb-2.5 flex items-center gap-2">
                  <TextInput
                    value={area.mainArea}
                    onChange={(e) => updateArea(ai, { mainArea: e.target.value })}
                    placeholder="Main area, e.g. Room Clean"
                    className="flex-1 font-semibold"
                    disabled={isDayViewMode}
                  />
                  {!isDayViewMode && currentAreas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentAreas((prev) => prev.filter((_, idx) => idx !== ai))}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-text-muted"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="mb-1.5 text-[11px] font-semibold text-text-muted">SUB TASKS</div>
                <div className="flex flex-col gap-2">
                  {area.subtasks.map((s, si) => (
                    <div key={si} className="flex items-center gap-2">
                      <TextInput
                        value={s}
                        onChange={(e) => updateSubtask(ai, si, e.target.value)}
                        placeholder="e.g. Vacuum carpets"
                        className="flex-1"
                        disabled={isDayViewMode}
                      />
                      {!isDayViewMode && area.subtasks.length > 1 && (
                        <button
                          type="button"
                          onClick={() => updateArea(ai, { subtasks: area.subtasks.filter((_, idx) => idx !== si) })}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-text-muted"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {!isDayViewMode && (
                    <button
                      type="button"
                      onClick={() => updateArea(ai, { subtasks: [...area.subtasks, ""] })}
                      className="w-fit text-[12.5px] font-semibold text-primary"
                    >
                      + Add sub task
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div className="rounded-[14px] border border-border bg-bg p-3.5">
              <div className="mb-1.5 text-[11px] font-semibold text-text-muted">NOTE FOR THIS DAY&apos;S CHECKLIST</div>
              <textarea
                value={dayNotes[activeDay] ?? ""}
                onChange={(e) => setDayNotes((prev) => ({ ...prev, [activeDay]: e.target.value }))}
                placeholder="Instructions for this day's checklist"
                rows={2}
                disabled={isDayViewMode}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary disabled:text-text-muted"
              />
              <div className="mt-2.5">
                {isDayViewMode ? (
                  (dayImages[activeDay] ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(dayImages[activeDay] ?? []).map((url) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={url} src={url} alt="Attachment" className="h-20 w-20 rounded-lg object-cover" />
                      ))}
                    </div>
                  )
                ) : (
                  <ImagePicker
                    images={dayImages[activeDay] ?? []}
                    onChange={(images) => setDayImages((prev) => ({ ...prev, [activeDay]: images }))}
                    uploadFile={uploadFile}
                  />
                )}
              </div>
            </div>

            {isDayViewMode ? (
              <button
                type="button"
                onClick={() => setEditingDays((prev) => new Set(prev).add(activeDay))}
                className="w-fit rounded-[11px] border border-border bg-white px-4 py-2 text-[12.5px] font-bold text-text-dark"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setCurrentAreas((prev) => [...prev, { ...EMPTY_AREA, subtasks: [""] }])}
                  className="w-fit text-sm font-bold text-primary"
                >
                  + Add another main area
                </button>
                <SaveDayButton
                  label={`Save ${DAY_LABELS[activeDay]} Checklist`}
                  onClick={() => {
                    saveIntentRef.current = "day";
                  }}
                />
              </>
            )}
          </>
        )}

        {state.error && (
          <div className="text-[12.5px] text-error-text">{state.error}</div>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
            Cancel
          </button>
          <SubmitButton
            label={isEdit ? "Save Changes" : "Create Template"}
            onClick={() => {
              saveIntentRef.current = "final";
            }}
          />
        </div>
      </form>
    </Modal>
  );
}
