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
