"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { getCurrentPosition } from "@macro/shared/geo";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  breakEndAction,
  breakStartAction,
  clockInAction,
  clockOutAction,
  type AttendanceActionState,
} from "./actions";

interface Site {
  id: string;
  name: string;
  lat: number;
  lng: number;
  companyName: string | null;
}

interface ActiveRecord {
  id: string;
  clock_in_at: string | null;
  break_started_at: string | null;
  total_break_minutes: number;
  status: "clocked_in" | "on_break" | "complete";
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

const ICONS = {
  clockIn: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10" />
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  ),
  clockOut: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  ),
  breakStart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  breakEnd: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  ),
  pin: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
};

const CARD_COLORS = {
  clockIn: { iconBg: "bg-primary/10", iconText: "text-primary" },
  clockOut: { iconBg: "bg-error/10", iconText: "text-error" },
  breakStart: { iconBg: "bg-orange/15", iconText: "text-orange" },
  breakEnd: { iconBg: "bg-olive/25", iconText: "text-olive-text" },
} as const;

function ActionCard({
  children,
  icon,
  disabled,
  color,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  disabled?: boolean;
  color: { iconBg: string; iconText: string };
  /** When provided, this renders as a plain button (e.g. to open a confirm dialog first) instead of submitting its parent form directly. */
  onClick?: () => void;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      disabled={disabled || pending}
      className="flex w-full flex-col items-center gap-2 rounded-2xl border border-border bg-white p-4 text-center shadow-sm transition-all enabled:hover:-translate-y-0.5 enabled:hover:shadow-md disabled:opacity-40"
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${color.iconBg} ${color.iconText}`}>
        {pending ? "…" : icon}
      </span>
      <span className="text-[13px] font-bold text-text-dark">{pending ? "Please wait…" : children}</span>
    </button>
  );
}

export function AttendanceClock({
  site,
  activeRecord,
}: {
  site: Site | null;
  activeRecord: ActiveRecord | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [locating, setLocating] = useState(false);
  const [locatingOut, setLocatingOut] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [confirmingClockOut, setConfirmingClockOut] = useState(false);
  const [, startTransition] = useTransition();

  const [clockInState, clockInFormAction] = useActionState<AttendanceActionState, FormData>(
    clockInAction,
    {}
  );
  const [clockOutState, clockOutFormAction] = useActionState<AttendanceActionState, FormData>(
    clockOutAction,
    {}
  );
  const [breakStartState, breakStartFormAction] = useActionState<AttendanceActionState, FormData>(
    breakStartAction,
    {}
  );
  const [breakEndState, breakEndFormAction] = useActionState<AttendanceActionState, FormData>(
    breakEndAction,
    {}
  );

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const isClockedIn = activeRecord?.status === "clocked_in";
  const isOnBreak = activeRecord?.status === "on_break";

  let workingMs = 0;
  if (activeRecord?.clock_in_at) {
    workingMs = now - new Date(activeRecord.clock_in_at).getTime();
    workingMs -= activeRecord.total_break_minutes * 60000;
    if (isOnBreak && activeRecord.break_started_at) {
      workingMs -= now - new Date(activeRecord.break_started_at).getTime();
    }
  }

  async function handleClockIn(formData: FormData) {
    if (!site) return;
    setGeoError(null);
    setLocating(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      formData.set("siteId", site.id);
      formData.set("lat", String(lat));
      formData.set("lng", String(lng));
      startTransition(() => {
        clockInFormAction(formData);
      });
    } catch {
      setGeoError("Location access is required to clock in.");
    } finally {
      setLocating(false);
    }
  }

  async function handleClockOut() {
    if (!activeRecord) return;
    setGeoError(null);
    setLocatingOut(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      const formData = new FormData();
      formData.set("attendanceId", activeRecord.id);
      formData.set("lat", String(lat));
      formData.set("lng", String(lng));
      startTransition(() => {
        clockOutFormAction(formData);
      });
    } catch {
      setGeoError("Location access is required to clock out.");
    } finally {
      setLocatingOut(false);
    }
  }

  function confirmClockOut() {
    setConfirmingClockOut(false);
    handleClockOut();
  }

  const statusLabel = isOnBreak ? "On Break" : isClockedIn ? "Clocked In" : "Clocked Out";
  const error = clockInState.error || clockOutState.error || breakStartState.error || breakEndState.error || geoError;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-6 text-white shadow-lg shadow-primary/20">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium text-white/70">
              {new Date(now).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </div>
            <div className="mt-1 text-[38px] font-extrabold leading-none tabular-nums">{formatDuration(workingMs)}</div>
            <div className="mt-1.5 text-xs text-white/80">Working hours</div>
          </div>
          <div className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">{statusLabel}</div>
        </div>

        {site ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-3">
            <span className="text-white/80">{ICONS.pin}</span>
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold">{site.name}</div>
              {site.companyName && <div className="truncate text-[11.5px] text-white/70">{site.companyName}</div>}
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-white/20 bg-white/10 p-3.5">
            <div className="text-xs">No assigned site yet — ask your admin to assign you to a company.</div>
          </div>
        )}

        {error && <div className="mt-3 rounded-lg bg-white/15 px-3 py-2 text-xs">{error}</div>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <form action={handleClockIn}>
          <ActionCard icon={ICONS.clockIn} color={CARD_COLORS.clockIn} disabled={Boolean(activeRecord) || !site || locating}>
            {locating ? "Getting GPS fix…" : "Clock In"}
          </ActionCard>
        </form>
        <ActionCard
          icon={ICONS.clockOut}
          color={CARD_COLORS.clockOut}
          disabled={!isClockedIn || locatingOut}
          onClick={() => setConfirmingClockOut(true)}
        >
          {locatingOut ? "Getting GPS fix…" : "Clock Out"}
        </ActionCard>
        <form action={breakStartFormAction}>
          <input type="hidden" name="attendanceId" value={activeRecord?.id ?? ""} />
          <ActionCard icon={ICONS.breakStart} color={CARD_COLORS.breakStart} disabled={!isClockedIn}>
            Break Start
          </ActionCard>
        </form>
        <form action={breakEndFormAction}>
          <input type="hidden" name="attendanceId" value={activeRecord?.id ?? ""} />
          <ActionCard icon={ICONS.breakEnd} color={CARD_COLORS.breakEnd} disabled={!isOnBreak}>
            Break End
          </ActionCard>
        </form>
      </div>

      <ConfirmDialog
        open={confirmingClockOut}
        title="Clock out?"
        message="This will end your shift and record your location."
        confirmLabel={locatingOut ? "Getting GPS fix…" : "Clock Out"}
        danger
        busy={locatingOut}
        onConfirm={confirmClockOut}
        onCancel={() => setConfirmingClockOut(false)}
      />
    </div>
  );
}
