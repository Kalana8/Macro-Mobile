// 28-day checklist cycle (migration 0055): 4 weeks, Monday to Sunday. Each
// subtask has its own frequency, resolved to cycle days 0–27 (0 = Week 1
// Monday, 27 = Week 4 Sunday). Mirrors public.checklist_areas_on() in SQL.
import type { ChecklistArea, ChecklistSubtask, SubtaskFrequency } from "../types";

export const CYCLE_DAYS = 28;
export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export interface CycleTemplate {
  cycle_start?: string | null;
  cycle_repeats?: boolean;
  cycle_end?: string | null;
  cycle_areas?: ChecklistArea[];
}

/** The cycle days a frequency covers. */
export function cycleDays(frequency: SubtaskFrequency, opts: { weekday?: number; weekdays?: number[]; week?: number; days?: number[] } = {}): number[] {
  const weekday = opts.weekday ?? 0;
  const week = opts.week ?? 0;
  switch (frequency) {
    case "daily":
      return Array.from({ length: CYCLE_DAYS }, (_, i) => i);
    case "weekly": {
      // One or more days, every week.
      const picked = [...new Set(opts.weekdays?.length ? opts.weekdays : [weekday])].filter((d) => d >= 0 && d < 7);
      return [0, 1, 2, 3].flatMap((w) => picked.map((d) => w * 7 + d)).sort((a, b) => a - b);
    }
    case "monthly":
      return [week * 7 + weekday];
    case "custom":
      return [...new Set(opts.days ?? [])].filter((d) => d >= 0 && d < CYCLE_DAYS).sort((a, b) => a - b);
  }
}

/** "Daily", "Weekly · Wed", "Monthly · Week 1 Mon", "Custom · 3 days". */
export function frequencyLabel(s: Pick<ChecklistSubtask, "frequency" | "weekday" | "weekdays" | "week" | "days">): string {
  switch (s.frequency) {
    case "weekly": {
      const picked = [...new Set(s.weekdays?.length ? s.weekdays : [s.weekday ?? 0])].sort((a, b) => a - b);
      return `Weekly · ${picked.map((d) => WEEKDAYS[d]).join(", ")}`;
    }
    case "monthly":
      return `Monthly · Week ${(s.week ?? 0) + 1} ${WEEKDAYS[s.weekday ?? 0]}`;
    case "custom": {
      const n = s.days?.length ?? 0;
      return `Custom · ${n} day${n === 1 ? "" : "s"}`;
    }
    default:
      return "Daily";
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;
const toTime = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** The Monday on or before a date. */
export function mondayOf(iso: string): string {
  const t = toTime(iso);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // 0 = Monday
  return toIso(t - dow * DAY_MS);
}

export function addDays(iso: string, days: number): string {
  return toIso(toTime(iso) + days * DAY_MS);
}

/** Where a date sits in the cycle (0–27), or null when the template sends nothing that day. */
export function cycleIndex(t: CycleTemplate, iso: string): number | null {
  if (!t.cycle_start) return null;
  const idx = Math.round((toTime(iso) - toTime(t.cycle_start)) / DAY_MS);
  if (idx < 0) return null;
  if (t.cycle_end && iso > t.cycle_end) return null;
  if (t.cycle_repeats === false && idx >= CYCLE_DAYS) return null;
  return idx % CYCLE_DAYS;
}

/** The areas, with only that day's subtasks, a cycle template sends on a date. Empty when nothing is due. */
export function areasOn(t: CycleTemplate, iso: string): ChecklistArea[] {
  const idx = cycleIndex(t, iso);
  if (idx === null) return [];
  return areasOnCycleDay(t.cycle_areas ?? [], idx);
}

/** The areas with only the subtasks that fall on one cycle day. Frequency details are left out of what's sent. */
export function areasOnCycleDay(areas: ChecklistArea[], idx: number): ChecklistArea[] {
  return areas
    .map((a) => ({
      ...a,
      subtasks: a.subtasks.filter((s) => (s.days ?? []).includes(idx)).map(({ id, text }) => ({ id, text })),
    }))
    .filter((a) => a.subtasks.length > 0);
}

/** The next date (from `fromIso`, inclusive) on which something is due, within one cycle; null if none. */
export function nextDueDate(t: CycleTemplate, fromIso: string): string | null {
  for (let i = 0; i < CYCLE_DAYS; i++) {
    const d = addDays(fromIso, i);
    if (areasOn(t, d).length > 0) return d;
  }
  return null;
}

/** Whether the cycle has finished for good (stopped, or ended). */
export function cycleEnded(t: CycleTemplate, todayIso: string): boolean {
  if (!t.cycle_start) return false;
  if (t.cycle_end && todayIso > t.cycle_end) return true;
  return t.cycle_repeats === false && todayIso > addDays(t.cycle_start, CYCLE_DAYS - 1);
}

/** "28-day cycle · repeats" / "· stops after 28 days" / "· ended". No dates: the cycle is Week 1–4, Mon–Sun. */
export function cycleSummary(t: CycleTemplate): string {
  if (!t.cycle_start) return "";
  if (t.cycle_end) return "28-day cycle · ended";
  return `28-day cycle · ${t.cycle_repeats === false ? "stops after 28 days" : "repeats"}`;
}

/** Where a date sits in the cycle, as words: "Week 2 Tuesday". */
export function cycleDayLabel(t: CycleTemplate, iso: string): string | null {
  const idx = cycleIndex(t, iso);
  return idx === null ? null : `Week ${Math.floor(idx / 7) + 1} ${WEEKDAY_NAMES[idx % 7]}`;
}
