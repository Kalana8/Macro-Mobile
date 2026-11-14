"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { ImagePicker } from "@/components/ImagePicker";
import { FieldLabel, PrimaryButton, Select, TextInput } from "@/components/ui";
import { todayInBusinessTimezone } from "@macro/shared/datetime";
import { areasOnCycleDay, cycleDays, frequencyLabel, mondayOf, WEEKDAY_NAMES, WEEKDAYS } from "@macro/shared/checklistCycle";
import type { ChecklistArea, ChecklistTemplate, Site, SubtaskFrequency } from "@macro/shared/types";
import { saveCycleTemplateAction, uploadChecklistImageAction, type ChecklistFormState } from "./actions";

interface DraftSubtask {
  id?: string;
  text: string;
  frequency: SubtaskFrequency;
  /** Monthly: the one day. */
  weekday: number;
  /** Weekly: one or more days. */
  weekdays: number[];
  week: number;
  /** Custom days, 0–27. */
  days: number[];
}
interface DraftArea {
  mainArea: string;
  note: string;
  images: string[];
  subtasks: DraftSubtask[];
}

const newSubtask = (): DraftSubtask => ({ text: "", frequency: "daily", weekday: 0, weekdays: [0], week: 0, days: [] });
const newArea = (): DraftArea => ({ mainArea: "", note: "", images: [], subtasks: [newSubtask()] });

function fromCycleAreas(areas: ChecklistArea[]): DraftArea[] {
  return areas.map((a) => ({
    mainArea: a.main_area,
    note: a.note,
    images: a.images ?? [],
    subtasks: a.subtasks.map((s) => ({
      id: s.id,
      text: s.text,
      frequency: s.frequency ?? "daily",
      weekday: s.weekday ?? 0,
      weekdays: s.weekdays?.length ? s.weekdays : [s.weekday ?? 0],
      week: s.week ?? 0,
      days: s.frequency === "custom" ? (s.days ?? []) : [],
    })),
  }));
}

/**
 * Opens an older, date-based template in the cycle editor: each subtask
 * becomes weekly on the weekdays it was on, or daily if it was on all seven.
 */
function fromWeekdayAreas(dayAreas: Record<string, ChecklistArea[]>): DraftArea[] {
  const byArea = new Map<string, { note: string; images: string[]; subs: Map<string, Set<number>> }>();
  for (const [dow, areas] of Object.entries(dayAreas)) {
    const weekday = (Number(dow) + 6) % 7; // stored 0 = Sunday; the cycle uses 0 = Monday
    for (const a of areas) {
      const entry = byArea.get(a.main_area) ?? { note: a.note, images: a.images ?? [], subs: new Map() };
      for (const s of a.subtasks) entry.subs.set(s.text, (entry.subs.get(s.text) ?? new Set()).add(weekday));
      byArea.set(a.main_area, entry);
    }
  }
  return [...byArea.entries()].map(([mainArea, e]) => ({
    mainArea,
    note: e.note,
    images: e.images,
    subtasks: [...e.subs.entries()].map(([text, wd]) => {
      if (wd.size === 7) return { ...newSubtask(), text };
      return { ...newSubtask(), text, frequency: "weekly" as const, weekdays: [...wd].sort((x, y) => x - y) };
    }),
  }));
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const result = await uploadChecklistImageAction(formData);
  if (result.error || !result.url) throw new Error(result.error ?? "Upload failed.");
  return result.url;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Saving…" : label}
    </PrimaryButton>
  );
}

/** A 4 × 7 grid of the cycle (Week 1–4, Monday–Sunday). */
function CycleGrid({
  cell,
  label,
  onPick,
  selected,
  compact,
}: {
  cell: (idx: number) => React.ReactNode;
  label: (idx: number) => string;
  onPick: (idx: number) => void;
  selected: (idx: number) => boolean;
  compact?: boolean;
}) {
  const size = compact ? "h-7 text-[11px]" : "h-12 text-[12px]";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate" style={{ borderSpacing: compact ? 3 : 4 }}>
        <thead>
          <tr>
            <th className="w-14" />
            {WEEKDAYS.map((d) => (
              <th key={d} className="text-center text-[11px] font-bold text-text-muted">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[0, 1, 2, 3].map((w) => (
            <tr key={w}>
              <th className="pr-1 text-left text-[11px] font-bold text-text-muted">Week {w + 1}</th>
              {WEEKDAYS.map((_, d) => {
                const idx = w * 7 + d;
                const on = selected(idx);
                return (
                  <td key={d} className="p-0">
                    <button
                      type="button"
                      aria-label={label(idx)}
                      aria-pressed={on}
                      onClick={() => onPick(idx)}
                      className={`w-full rounded-md font-bold ${size} ${on ? "bg-primary text-white" : "bg-bg text-text-dark"}`}
                    >
                      {cell(idx)}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Create or edit a checklist on a 28-day cycle: 4 weeks, Monday to Sunday.
 * Every subtask has its own frequency (daily, weekly, monthly or custom days),
 * and after the 28 days the checklist repeats or stops.
 */
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
  const [state, formAction] = useActionState<ChecklistFormState, FormData>(saveCycleTemplateAction, {});
  const savedId = state.id ?? template?.id ?? null;

  // Two rows can share a company name (a known data quirk): one entry per name.
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
  // The cycle runs from the Monday of the week the checklist is made. It's never shown: everything is Week 1–4, Mon–Sun.
  const start = template?.cycle_start ?? mondayOf(todayInBusinessTimezone());
  const [repeats, setRepeats] = useState(template?.cycle_repeats !== false);
  const [areas, setAreas] = useState<DraftArea[]>(() => {
    if (template?.cycle_start && template.cycle_areas?.length) return fromCycleAreas(template.cycle_areas);
    if (template && Object.keys(template.day_areas ?? {}).length) return fromWeekdayAreas(template.day_areas);
    return [newArea()];
  });
  const [day, setDay] = useState(0);

  useEffect(() => {
    if (state.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  const updateArea = (ai: number, patch: Partial<DraftArea>) => setAreas((prev) => prev.map((a, i) => (i === ai ? { ...a, ...patch } : a)));
  const updateSub = (ai: number, si: number, patch: Partial<DraftSubtask>) =>
    setAreas((prev) => prev.map((a, i) => (i === ai ? { ...a, subtasks: a.subtasks.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : a)));

  // What each cycle day holds, for the overview grid.
  const resolved: ChecklistArea[] = useMemo(
    () =>
      areas
        .filter((a) => a.mainArea.trim())
        .map((a) => ({
          main_area: a.mainArea.trim(),
          note: a.note,
          images: a.images,
          subtasks: a.subtasks
            .filter((s) => s.text.trim())
            .map((s, i) => ({ id: s.id ?? `draft-${i}`, text: s.text.trim(), days: cycleDays(s.frequency, s) })),
        })),
    [areas],
  );
  const countOn = (idx: number) => areasOnCycleDay(resolved, idx).reduce((n, a) => n + a.subtasks.length, 0);
  const dayAreas = areasOnCycleDay(resolved, day);

  const payload = JSON.stringify({ start, repeats, areas });

  return (
    <Modal title={isEdit ? "Edit Checklist" : "Create Checklist"} onClose={onClose} wide>
      <form action={formAction} className="flex flex-col gap-4">
        {savedId && <input type="hidden" name="templateId" value={savedId} />}
        <input type="hidden" name="cycleJson" value={payload} />
        <input type="hidden" name="siteId" value={siteId} />
        <input type="hidden" name="specialNote" value={specialNote} />

        <div className="grid gap-3 sm:grid-cols-2">
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
              {uniqueCompanies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel>Site</FieldLabel>
            <Select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">{siteOptions.length === 0 ? "No sites for this company" : "Select a site"}</option>
              {siteOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div>
            <FieldLabel>After 28 days</FieldLabel>
            <div className="flex gap-2" role="radiogroup" aria-label="After 28 days">
              {(
                [
                  [true, "Repeat", "Starts again at Week 1"],
                  [false, "Stop", "Nothing more is sent"],
                ] as const
              ).map(([value, title, hint]) => (
                <button
                  key={title}
                  type="button"
                  role="radio"
                  aria-checked={repeats === value}
                  onClick={() => setRepeats(value)}
                  className={`flex-1 rounded-[12px] border px-3 py-2 text-left ${repeats === value ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <span className="block text-sm font-bold text-text-dark">{title}</span>
                  <span className="block text-[11px] text-text-muted">{hint}</span>
                </button>
              ))}
            </div>
        </div>

        <div>
          <FieldLabel>Main tasks</FieldLabel>
          <div className="flex flex-col gap-3">
            {areas.map((area, ai) => (
              <div key={ai} className="rounded-[14px] border border-border bg-bg p-3.5">
                <div className="mb-2.5 flex items-center gap-2">
                  <TextInput
                    value={area.mainArea}
                    onChange={(e) => updateArea(ai, { mainArea: e.target.value })}
                    placeholder="Main task, e.g. Windows"
                    aria-label={`Main task ${ai + 1}`}
                    className="flex-1 font-semibold"
                  />
                  {areas.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remove main task ${area.mainArea || ai + 1}`}
                      onClick={() => setAreas((prev) => prev.filter((_, i) => i !== ai))}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-text-muted"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="mb-1.5 text-[11px] font-semibold text-text-muted">SUBTASKS</div>
                <div className="flex flex-col gap-2.5">
                  {area.subtasks.map((s, si) => (
                    <div key={si} className="rounded-[12px] bg-white p-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <TextInput
                          value={s.text}
                          onChange={(e) => updateSub(ai, si, { text: e.target.value })}
                          placeholder="e.g. Glass Doors – Spot Clean"
                          aria-label={`Subtask ${si + 1} of ${area.mainArea || "main task"}`}
                          className="min-w-[180px] flex-1"
                        />
                        <Select
                          value={s.frequency}
                          aria-label={`How often: ${s.text || `subtask ${si + 1}`}`}
                          onChange={(e) => updateSub(ai, si, { frequency: e.target.value as SubtaskFrequency })}
                          className="w-auto"
                        >
                          <option value="daily">Daily</option>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                          <option value="custom">Custom</option>
                        </Select>
                        {s.frequency === "monthly" && (
                          <Select value={s.week} aria-label="Which week" onChange={(e) => updateSub(ai, si, { week: Number(e.target.value) })} className="w-auto">
                            {[0, 1, 2, 3].map((w) => (
                              <option key={w} value={w}>
                                Week {w + 1}
                              </option>
                            ))}
                          </Select>
                        )}

                        {area.subtasks.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Remove subtask ${s.text || si + 1}`}
                            onClick={() => updateArea(ai, { subtasks: area.subtasks.filter((_, j) => j !== si) })}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-text-muted"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                      {s.frequency !== "custom" && (
                        // Daily: all seven days, fixed. Weekly: tap one or more days. Monthly: tap the one day.
                        <div
                          className="mt-2 flex flex-wrap gap-1"
                          role={s.frequency === "monthly" ? "radiogroup" : "group"}
                          aria-label={s.frequency === "daily" ? "Every day" : s.frequency === "weekly" ? "Which days" : "Which day"}
                        >
                          {WEEKDAYS.map((d, i) => {
                            const on = s.frequency === "daily" || (s.frequency === "weekly" ? s.weekdays.includes(i) : s.weekday === i);
                            return (
                              <button
                                key={d}
                                type="button"
                                role={s.frequency === "monthly" ? "radio" : s.frequency === "weekly" ? "checkbox" : undefined}
                                aria-checked={s.frequency === "daily" ? undefined : on}
                                aria-label={WEEKDAY_NAMES[i]}
                                disabled={s.frequency === "daily"}
                                onClick={() =>
                                  s.frequency === "weekly"
                                    ? updateSub(ai, si, { weekdays: s.weekdays.includes(i) ? s.weekdays.filter((x) => x !== i) : [...s.weekdays, i].sort((x, y) => x - y) })
                                    : updateSub(ai, si, { weekday: i })
                                }
                                className={`h-8 min-w-[42px] rounded-md px-2 text-[12px] font-bold ${on ? "bg-primary text-white" : "bg-bg text-text-dark"} disabled:cursor-default`}
                              >
                                {d}
                              </button>
                            );
                          })}
                        </div>
                      )}
                      {s.frequency === "custom" && (
                        <div className="mt-2">
                          <div className="mb-1 text-[11px] text-text-muted">Tick the days ({s.days.length} picked)</div>
                          <CycleGrid
                            compact
                            selected={(idx) => s.days.includes(idx)}
                            onPick={(idx) => updateSub(ai, si, { days: s.days.includes(idx) ? s.days.filter((d) => d !== idx) : [...s.days, idx] })}
                            label={(idx) => `Week ${Math.floor(idx / 7) + 1} ${WEEKDAY_NAMES[idx % 7]}`}
                            cell={(idx) => (s.days.includes(idx) ? "✓" : "")}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => updateArea(ai, { subtasks: [...area.subtasks, newSubtask()] })} className="w-fit text-[12.5px] font-semibold text-primary">
                    + Add subtask
                  </button>
                </div>

                <details className="mt-2.5">
                  <summary className="cursor-pointer text-[12px] font-semibold text-text-muted">Note and photos for this main task</summary>
                  <textarea
                    value={area.note}
                    onChange={(e) => updateArea(ai, { note: e.target.value })}
                    placeholder="Instructions shown with this main task"
                    rows={2}
                    className="mt-2 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <div className="mt-2">
                    <ImagePicker images={area.images} onChange={(images) => updateArea(ai, { images })} uploadFile={uploadFile} />
                  </div>
                </details>
              </div>
            ))}
            <button type="button" onClick={() => setAreas((prev) => [...prev, newArea()])} className="w-fit text-sm font-bold text-primary">
              + Add main task
            </button>
          </div>
        </div>

        <div>
          <FieldLabel>28-day schedule</FieldLabel>
          <p className="-mt-1 mb-2 text-[11px] text-text-muted">How many subtasks fall on each day. Click a day to see them.</p>
          <CycleGrid
            selected={(idx) => idx === day}
            onPick={setDay}
            label={(idx) => `Week ${Math.floor(idx / 7) + 1} ${WEEKDAY_NAMES[idx % 7]}, ${countOn(idx)} subtasks`}
            cell={(idx) => countOn(idx) || "–"}
          />
          <div className="mt-2 rounded-[12px] bg-bg px-3.5 py-3">
            <div className="mb-1.5 text-[12px] font-extrabold text-primary">
              Week {Math.floor(day / 7) + 1} {WEEKDAY_NAMES[day % 7]}
            </div>
            {dayAreas.length === 0 ? (
              <div className="text-[12.5px] text-text-muted">Nothing on this day.</div>
            ) : (
              dayAreas.map((a) => (
                <div key={a.main_area} className="mb-2 last:mb-0">
                  <div className="text-[13px] font-bold text-text-dark">{a.main_area}</div>
                  {a.subtasks.map((s) => {
                    const src = areas.flatMap((x) => x.subtasks).find((d) => d.text.trim() === s.text);
                    return (
                      <div key={s.id} className="pl-2 text-[12.5px] text-text-muted">
                        • {s.text}
                        {src && src.frequency !== "daily" && <span className="ml-1 text-[11px] text-primary">({frequencyLabel(src)})</span>}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <FieldLabel>Special notes</FieldLabel>
          <textarea
            value={specialNote}
            onChange={(e) => setSpecialNote(e.target.value)}
            placeholder="Shown to the employee as a highlighted Specific Task"
            rows={2}
            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        {state.error && <div className="text-[12.5px] text-error-text">{state.error}</div>}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
            Cancel
          </button>
          <SubmitButton label={isEdit ? "Save Changes" : "Create Checklist"} />
        </div>
      </form>
    </Modal>
  );
}
