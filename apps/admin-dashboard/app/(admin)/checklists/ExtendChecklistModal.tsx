"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { FieldLabel, PrimaryButton, Select, TextInput } from "@/components/ui";
import { todayInBusinessTimezone } from "@macro/shared/datetime";
import type { Checklist } from "@macro/shared/types";
import { checklistName } from "@/lib/checklistName";
import { extendChecklistAction } from "./actions";
import { dueMomentLabel, effectiveDueHours, hourNowInBusinessTimezone, hoursSinceDayStart, hoursUntil } from "./templateContent";

/** "Extend to…": pick the date and time an expired checklist is on time until. */
export function ExtendChecklistModal({
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
  const router = useRouter();
  const today = todayInBusinessTimezone();
  const [date, setDate] = useState(today);
  const [hour12, setHour12] = useState(5);
  const [pm, setPm] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  const h24 = (hour12 % 12) + (pm ? 12 : 0);
  const hours = hoursUntil(checklist.assigned_date, date, h24);
  const now = hoursSinceDayStart(checklist.assigned_date, today, hourNowInBusinessTimezone());
  const tooEarly = hours <= now;

  const save = (value: number | null) =>
    start(async () => {
      setError(null);
      const res = await extendChecklistAction(checklist.id, value);
      if (res.error) return setError(res.error);
      router.refresh();
      onClose();
    });

  return (
    <Modal title="Extend checklist" onClose={onClose}>
      <div className="mb-4 text-sm text-text-muted">
        <div className="font-semibold text-text-dark">{checklistName(companyName, checklist.site)}</div>
        {employeeName} · was due {dueMomentLabel(checklist.assigned_date, effectiveDueHours(checklist))}
      </div>

      <FieldLabel>On time until</FieldLabel>
      <div className="grid grid-cols-[1.5fr_1fr_0.8fr] gap-2">
        <TextInput type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} aria-label="Date" />
        <Select value={hour12} onChange={(e) => setHour12(Number(e.target.value))} aria-label="Hour">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={h}>
              {h}:00
            </option>
          ))}
        </Select>
        <Select value={pm ? "pm" : "am"} onChange={(e) => setPm(e.target.value === "pm")} aria-label="AM or PM">
          <option value="am">AM</option>
          <option value="pm">PM</option>
        </Select>
      </div>
      <p className="mt-1.5 text-[11.5px] text-text-muted">
        {tooEarly ? (
          <span className="text-error-text">Pick a time later than now.</span>
        ) : (
          <>
            It shows as on time in the app until <span className="font-semibold text-text-dark">{dueMomentLabel(checklist.assigned_date, hours)}</span>, then expired again.
          </>
        )}
      </p>
      {error && <p className="mt-2 text-[12px] text-error-text">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        {checklist.extended_due_hours != null && (
          <button type="button" disabled={saving} onClick={() => save(null)} className="rounded-[12px] bg-bg px-4 py-3 text-sm font-bold text-text-dark">
            Remove extension
          </button>
        )}
        <PrimaryButton type="button" disabled={saving || tooEarly || !date} onClick={() => save(hours)} className="flex-1 justify-center">
          {saving ? "Saving…" : "Extend"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
