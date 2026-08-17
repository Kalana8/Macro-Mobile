// Visit scheduling lives on the checklist template (set in Create
// Checklist) — an explicit list of calendar dates picked from the 4-week
// grid.
export interface Schedulable {
  visit_dates: string[];
}

/** Short one-line summary — used in tables and dropdown-adjacent lists. */
export function scheduleSummary(schedule: Schedulable): string {
  // Defensive against rows fetched before the visit_dates column existed on
  // this table (mid-migration) — treat missing dates as unset rather than
  // throwing.
  const dates = [...(schedule.visit_dates ?? [])].sort();
  if (dates.length === 0) return "No dates set";
  if (dates.length === 1) return dates[0];
  return `${dates.length} dates (next ${dates[0]})`;
}
