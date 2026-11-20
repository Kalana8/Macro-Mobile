import type { ChecklistArea, ChecklistTemplate } from "@macro/shared/types";
import { cycleSummary, frequencyLabel } from "@macro/shared/checklistCycle";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Week shown Monday first, as staff rosters are.
const DAY_ORDER = ["1", "2", "3", "4", "5", "6", "0"];

type TemplateContent = Pick<ChecklistTemplate, "areas" | "day_areas" | "cycle_start" | "cycle_repeats" | "cycle_end" | "cycle_areas">;

/**
 * A template's tasks, one entry per weekday. day_areas is where the editor
 * saves content; `areas` is only a fallback for templates made before that.
 */
export function templateDays(t: TemplateContent): { day: string; label: string; areas: ChecklistArea[] }[] {
  // A 28-day cycle template: one list, each subtask showing how often it's done.
  if (t.cycle_start && (t.cycle_areas ?? []).length > 0) {
    const areas = (t.cycle_areas ?? []).map((a) => ({
      ...a,
      subtasks: a.subtasks.map((s) => ({ ...s, text: s.frequency && s.frequency !== "daily" ? `${s.text} (${frequencyLabel(s)})` : s.text })),
    }));
    return [{ day: "cycle", label: cycleSummary(t), areas }];
  }
  const byDay = t.day_areas ?? {};
  const days = DAY_ORDER.filter((d) => (byDay[d] ?? []).length > 0).map((d) => ({ day: d, label: DAY_NAMES[Number(d)], areas: byDay[d] }));
  if (days.length > 0) return days;
  return (t.areas ?? []).length > 0 ? [{ day: "all", label: "Every visit", areas: t.areas }] : [];
}

export function templateSubtaskCount(t: TemplateContent): number {
  return templateDays(t).reduce((n, d) => n + d.areas.reduce((m, a) => m + a.subtasks.length, 0), 0);
}

/** Every main area name, without repeats, for a one-line title. */
export function templateAreaNames(t: TemplateContent): string {
  return [...new Set(templateDays(t).flatMap((d) => d.areas.map((a) => a.main_area)))].join(", ");
}

/** A checklist's done-by time in hours after the start of its day (1–47); 10:00 am next day if not set. */
export function dueHoursOf(t: { due_hours?: number | null; day_ends_at_hour?: number | null } | null | undefined): number {
  if (t?.due_hours != null) return t.due_hours;
  return 24 + (t?.day_ends_at_hour ?? 10);
}

/** "5:00 pm", "12:00 am" for an hour of the day 0–23. */
export function clockLabel(h24: number): string {
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:00 ${h24 < 12 ? "am" : "pm"}`;
}

/** "5:00 pm the same day", "10:00 am the next day", "midnight (end of the same day)". */
export function doneByLabel(t: { due_hours?: number | null; day_ends_at_hour?: number | null } | null | undefined): string {
  const due = dueHoursOf(t);
  if (due === 24) return "midnight (end of the same day)";
  return due < 24 ? `${clockLabel(due)} the same day` : `${clockLabel(due - 24)} the next day`;
}

type DueFields = { assigned_date: string; due_hours?: number | null; day_ends_at_hour?: number | null; extended_due_hours?: number | null };

/** When a checklist is due: an admin's extension if it has one, else its done-by time. Hours after the start of its day. */
export const effectiveDueHours = (c: DueFields) => c.extended_due_hours ?? dueHoursOf(c);

const DAY_MS = 24 * 60 * 60 * 1000;
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/** Hours from the start of a checklist's day to now (business time). */
export function hoursSinceDayStart(assignedDate: string, today: string, hourNow: number) {
  return dayDiff(assignedDate, today) * 24 + hourNow;
}

/** "Tue 18 Nov, 5:00 pm": the moment that's `hours` after the start of `date`. */
export function dueMomentLabel(date: string, hours: number): string {
  const d = new Date(Date.parse(`${date}T00:00:00Z`) + Math.floor(hours / 24) * DAY_MS);
  const day = d.toLocaleDateString("en-AU", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${clockLabel(hours % 24)}`;
}

/** Hours after the start of `assignedDate` for a chosen date and hour (0–23). */
export const hoursUntil = (assignedDate: string, date: string, h24: number) => dayDiff(assignedDate, date) * 24 + h24;

/** Current hour (0–23) in business time. */
export const hourNowInBusinessTimezone = () =>
  Number(new Intl.DateTimeFormat("en-US", { timeZone: "Australia/Sydney", hour: "numeric", hourCycle: "h23" }).format(new Date()));
