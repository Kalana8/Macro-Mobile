"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { LocationField } from "@/components/LocationField";
import { ImagePicker } from "@/components/ImagePicker";
import { FieldLabel, PrimaryButton, Select, TextInput } from "@/components/ui";
import {
  checkCompanyNameAction,
  createCompanyAction,
  updateCompanyAction,
  uploadCompanyLogoAction,
  type CompanyFormState,
} from "./actions";
import type { Company, VisitFrequency } from "@macro/shared/types";

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const result = await uploadCompanyLogoAction(formData);
  if (result.error || !result.url) throw new Error(result.error ?? "Upload failed.");
  return result.url;
}

// Indices match Postgres extract(dow): 0 = Sunday ... 6 = Saturday.
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKEND_DAYS = [0, 6];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const FREQUENCY_OPTIONS: { value: VisitFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "custom", label: "Custom Range" },
];

const WEEKDAY_HEADERS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Date.toISOString() converts to UTC first, which rolls back to the
// previous day for any timezone ahead of UTC (e.g. Sri Lanka, UTC+5:30) —
// that's what made a just-picked date render as "the day before". Every
// date-to-string conversion in this file must go through this instead.
function toLocalISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Whether a given calendar date is one generate_due_checklists() would fire on — client-side mirror for the preview calendar. */
function matchesSchedule(
  date: Date,
  frequency: VisitFrequency,
  days: number[],
  startDate: string,
  endDate: string
): boolean {
  const iso = toLocalISODate(date);
  if (startDate && iso < startDate) return false;
  if (endDate && iso > endDate) return false;

  if (frequency === "custom") return Boolean(startDate && endDate);
  if (!days.includes(date.getDay())) return false;
  if (frequency === "weekly") return true;

  // fortnightly — needs the start date as the anchor for the every-other-week math
  if (!startDate) return false;
  const anchor = new Date(`${startDate}T00:00:00`);
  const diffDays = Math.round((date.getTime() - anchor.getTime()) / 86400000);
  return Math.floor(diffDays / 7) % 2 === 0;
}

/** Month-view calendar highlighting which real dates the current schedule selection resolves to, with prev/next month arrows for schedules that span further out. */
function ScheduleCalendar({
  frequency,
  days,
  startDate,
  endDate,
}: {
  frequency: VisitFrequency;
  days: number[];
  startDate: string;
  endDate: string;
}) {
  const [viewDate, setViewDate] = useState(() => {
    const anchor = startDate ? new Date(`${startDate}T00:00:00`) : new Date();
    return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  });

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const leadingBlanks = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const totalCells = Math.ceil((leadingBlanks + daysInMonth) / 7) * 7;
  const todayIso = toLocalISODate(new Date());

  return (
    <div className="mt-3 rounded-lg bg-bg p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-text-dark"
        >
          ‹
        </button>
        <div className="text-xs font-bold text-text-dark">
          {viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </div>
        <button
          type="button"
          onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-text-dark"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_HEADERS.map((w) => (
          <div key={w} className="py-1 text-[10px] font-bold text-text-muted">
            {w}
          </div>
        ))}
        {Array.from({ length: totalCells }, (_, i) => {
          const cellDate = new Date(year, month, i - leadingBlanks + 1);
          const inMonth = cellDate.getMonth() === month;
          const iso = toLocalISODate(cellDate);
          const active = inMonth && matchesSchedule(cellDate, frequency, days, startDate, endDate);
          const isToday = iso === todayIso;
          return (
            <div
              key={i}
              className={`rounded-md py-1.5 text-[11px] font-semibold ${
                !inMonth
                  ? "text-transparent"
                  : active
                    ? "bg-primary text-white"
                    : isToday
                      ? "border border-primary text-text-dark"
                      : "text-text-muted"
              }`}
            >
              {inMonth ? cellDate.getDate() : "-"}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : label}</PrimaryButton>;
}

export function CompanyModal({ company, onClose }: { company?: Company; onClose: () => void }) {
  const isEdit = Boolean(company);
  const action = isEdit ? updateCompanyAction : createCompanyAction;
  const [state, formAction] = useActionState<CompanyFormState, FormData>(action, {});
  const [name, setName] = useState(company?.name ?? "");
  const [checkingName, setCheckingName] = useState(false);
  const [nameCheck, setNameCheck] = useState<"idle" | "clear" | "duplicate">("idle");
  const [logo, setLogo] = useState<string | null>(company?.logo ?? null);

  const [visitFrequency, setVisitFrequency] = useState<VisitFrequency>(company?.visit_frequency ?? "weekly");
  const [visitDays, setVisitDays] = useState<number[]>(company?.visit_days ?? []);
  const [visitStartDate, setVisitStartDate] = useState(company?.visit_start_date ?? "");
  const [visitEndDate, setVisitEndDate] = useState(company?.visit_end_date ?? "");

  useEffect(() => {
    if (state.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  function toggleDay(day: number) {
    setVisitDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  async function handleCheckName() {
    if (!name.trim()) return;
    setCheckingName(true);
    try {
      const { exists } = await checkCompanyNameAction(name);
      setNameCheck(exists ? "duplicate" : "clear");
    } finally {
      setCheckingName(false);
    }
  }

  return (
    <Modal title={isEdit ? "Edit Company" : "Add Company"} onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        {isEdit && <input type="hidden" name="id" value={company!.id} />}

        <div>
          <FieldLabel>Company Name</FieldLabel>
          <TextInput
            name="name"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameCheck("idle");
            }}
            placeholder="e.g. Acme Corp"
          />
          {!isEdit && (
            <>
              <button
                type="button"
                onClick={handleCheckName}
                disabled={checkingName || !name.trim()}
                className="mt-1.5 text-[12.5px] font-semibold text-primary disabled:opacity-40"
              >
                {checkingName ? "Checking…" : "Check Name"}
              </button>
              {nameCheck === "duplicate" && (
                <p className="mt-1 text-[11.5px] text-[#B35A10]">
                  A company named &quot;{name}&quot; already exists. You can continue anyway, or use a different name.
                </p>
              )}
              {nameCheck === "clear" && (
                <p className="mt-1 text-[11.5px] text-olive-text">No existing company has this name.</p>
              )}
            </>
          )}
        </div>

        {!isEdit && (
          <div>
            <FieldLabel>Site Name</FieldLabel>
            <TextInput name="siteName" required placeholder="e.g. Main Office" />
          </div>
        )}

        {isEdit ? (
          <div>
            <FieldLabel>Location</FieldLabel>
            <TextInput name="location" defaultValue={company?.location ?? ""} placeholder="e.g. 123 Main St, Colombo (optional)" />
          </div>
        ) : (
          <LocationField addressFieldName="location" latFieldName="siteLat" lngFieldName="siteLng" />
        )}

        <div>
          <FieldLabel>Status</FieldLabel>
          <Select name="status" defaultValue={company?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        <div>
          <FieldLabel>Company Logo</FieldLabel>
          <input type="hidden" name="logo" value={logo ?? ""} />
          <ImagePicker
            images={logo ? [logo] : []}
            onChange={(images) => setLogo(images[images.length - 1] ?? null)}
            uploadFile={uploadFile}
          />
        </div>

        <div>
          <FieldLabel>Visit Schedule</FieldLabel>
          <div className="rounded-xl border border-border p-3">
            <div className="mb-3 flex gap-1.5 rounded-lg bg-bg p-1">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setVisitFrequency(opt.value)}
                  className={`flex-1 rounded-md py-2 text-xs font-bold ${
                    visitFrequency === opt.value ? "bg-white text-primary shadow-sm" : "text-text-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {visitFrequency !== "custom" && (
              <div className="mb-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setVisitDays(WEEKDAYS)}
                  className="rounded-md bg-bg px-2.5 py-1 text-[11px] font-semibold text-text-muted"
                >
                  Weekdays only
                </button>
                <button
                  type="button"
                  onClick={() => setVisitDays(WEEKEND_DAYS)}
                  className="rounded-md bg-bg px-2.5 py-1 text-[11px] font-semibold text-text-muted"
                >
                  Weekends only
                </button>
                <button
                  type="button"
                  onClick={() => setVisitDays(ALL_DAYS)}
                  className="rounded-md bg-bg px-2.5 py-1 text-[11px] font-semibold text-text-muted"
                >
                  Every day
                </button>
              </div>
            )}

            {visitFrequency !== "custom" && (
              <div className="grid grid-cols-7 gap-1.5">
                {DAY_LETTERS.map((letter, day) => {
                  const active = visitDays.includes(day);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`rounded-lg py-2.5 text-xs font-bold ${
                        active ? "bg-primary text-white" : "bg-bg text-text-muted"
                      }`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-3 flex gap-2.5">
              <div className="flex-1">
                <FieldLabel>
                  Start Date{visitFrequency === "weekly" ? " (optional)" : ""}
                </FieldLabel>
                <TextInput type="date" value={visitStartDate} onChange={(e) => setVisitStartDate(e.target.value)} />
              </div>
              <div className="flex-1">
                <FieldLabel>
                  End Date{visitFrequency !== "custom" ? " (optional)" : ""}
                </FieldLabel>
                <TextInput type="date" value={visitEndDate} onChange={(e) => setVisitEndDate(e.target.value)} />
              </div>
            </div>
            {visitFrequency === "fortnightly" && (
              <p className="mt-1 text-[11px] text-text-muted">
                Start date sets which week the every-other-week cycle counts from.
              </p>
            )}

            <p className="mt-3 text-[11px] text-text-muted">
              Checklists auto-generate right after midnight (Australia/Sydney) on each selected day above.
            </p>

            {/* Keyed on startDate so picking a new start date snaps the calendar to that month, without a setState-in-effect. */}
            <ScheduleCalendar
              key={visitStartDate}
              frequency={visitFrequency}
              days={visitDays}
              startDate={visitStartDate}
              endDate={visitEndDate}
            />
          </div>

          <input type="hidden" name="visitFrequency" value={visitFrequency} />
          <input type="hidden" name="visitStartDate" value={visitStartDate} />
          <input type="hidden" name="visitEndDate" value={visitEndDate} />
          {visitDays.map((day) => (
            <input key={day} type="hidden" name="visitDays" value={day} />
          ))}
        </div>

        {state.error && <div className="text-[12.5px] text-error-text">{state.error}</div>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
            Cancel
          </button>
          <SubmitButton label={isEdit ? "Save Changes" : "Register"} />
        </div>
      </form>
    </Modal>
  );
}
