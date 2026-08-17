"use client";

import { FieldLabel } from "@/components/ui";

// Indices match Postgres extract(dow): 0 = Sunday ... 6 = Saturday.
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

// Date.toISOString() converts to UTC first, which rolls back to the
// previous day for any timezone ahead of UTC (e.g. Sri Lanka, UTC+5:30) —
// that's what made a just-picked date render as "the day before". Every
// date-to-string conversion in this file must go through this instead.
export function toLocalISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 4 weeks of actual calendar dates, row 1 = this week (Sun..Sat), row 4 = 3 weeks out. */
function buildFourWeeks(): Date[][] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  const weeks: Date[][] = [];
  for (let w = 0; w < 4; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + w * 7 + d);
      row.push(day);
    }
    weeks.push(row);
  }
  return weeks;
}

/**
 * Every date is picked individually — tapping a cell toggles just that one
 * date, on its own, no other cell moves with it. Content for a date is still
 * looked up by its weekday (edited once per weekday in the checklist-content
 * section below), so picking several Mondays across different weeks
 * automatically reuses the same Monday content on each of them.
 */
export function VisitScheduleFields({
  dates,
  onDatesChange,
}: {
  dates: string[];
  onDatesChange: (dates: string[]) => void;
}) {
  const weeks = buildFourWeeks();
  const todayIso = toLocalISODate(new Date());
  const selected = new Set(dates);

  function toggleDate(iso: string, isPast: boolean) {
    if (isPast) return;
    onDatesChange(selected.has(iso) ? dates.filter((d) => d !== iso) : [...dates, iso]);
  }

  return (
    <div>
      <FieldLabel>Visit Schedule</FieldLabel>
      <div className="rounded-xl border border-border p-3">
        <div className="flex flex-col gap-1.5">
          {weeks.map((row, ri) => (
            <div key={ri} className="grid grid-cols-7 gap-1.5">
              {row.map((day) => {
                const iso = toLocalISODate(day);
                const isPast = iso < todayIso;
                const active = selected.has(iso);
                return (
                  <button
                    type="button"
                    key={iso}
                    disabled={isPast}
                    onClick={() => toggleDate(iso, isPast)}
                    title={iso}
                    className={`rounded-lg py-2 text-xs font-bold ${
                      active
                        ? "bg-primary text-white"
                        : isPast
                          ? "cursor-not-allowed text-text-muted/30"
                          : "bg-bg text-text-muted"
                    }`}
                  >
                    {DAY_LETTERS[day.getDay()]}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <p className="mt-3 text-[11px] text-text-muted">
          Tap any date to schedule it — each one is independent. Checklists auto-generate right after midnight
          (Australia/Sydney) on each picked date.
        </p>
      </div>

      {dates.map((d) => (
        <input key={d} type="hidden" name="visitDates" value={d} />
      ))}
    </div>
  );
}
