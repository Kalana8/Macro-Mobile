import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";
import { formatDate, formatTime, todayInBusinessTimezone } from "@macro/shared/datetime";
import { Badge, EmptyState, PageHeader, Table } from "@/components/ui";

function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfWeek(offsetWeeks: number): Date {
  const [y, m, day] = todayInBusinessTimezone().split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, day));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay() + offsetWeeks * 7);
  return d;
}

function timeOf(iso: string | null): string {
  if (!iso) return "—";
  return formatTime(iso, { hour: "2-digit", minute: "2-digit" });
}

function hoursOf(clockIn: string | null, clockOut: string | null, breakMinutes: number): string {
  if (!clockIn || !clockOut) return "—";
  const ms = new Date(clockOut).getTime() - new Date(clockIn).getTime() - breakMinutes * 60000;
  return `${(ms / 3600000).toFixed(1)}h`;
}

function breakOf(minutes: number): string {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function LocationLink({ lat, lng }: { lat: number | null; lng: number | null }) {
  if (lat == null || lng == null) return <span className="text-text-muted">—</span>;
  return (
    <a
      href={`https://www.google.com/maps?q=${lat},${lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-primary"
    >
      📍 View
    </a>
  );
}

export default async function EmployeeAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ employeeId: string }>;
  searchParams: Promise<{ tab?: string; date?: string; week?: string }>;
}) {
  const { employeeId } = await params;
  const { tab: tabParam, date, week } = await searchParams;
  const tab = tabParam === "weekly" ? "weekly" : "daily";

  const supabase = await createClient();

  const { data: employee } = await supabase
    .from("employees")
    .select("id, full_name, job_role")
    .eq("id", employeeId)
    .maybeSingle();

  if (!employee) notFound();

  const day = date ?? todayInBusinessTimezone();
  const weekOffset = Number(week ?? 0) || 0;
  const weekStart = startOfWeek(weekOffset);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  const selectedDayLabel = formatDate(new Date(day + "T00:00:00"), {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const selectedWeekLabel = `${formatDate(weekStart, { month: "short", day: "numeric" })} – ${formatDate(weekEnd, { month: "short", day: "numeric" })}, ${weekEnd.getFullYear()}`;

  const baseQuery = supabase
    .from("attendance")
    .select(
      "id, date, clock_in_at, clock_out_at, total_break_minutes, geo_verified, clock_in_lat, clock_in_lng, clock_out_lat, clock_out_lng, clock_out_geo_verified, status, companies(name), sites(name)"
    )
    .eq("employee_id", employeeId);

  const { data: records, error } =
    tab === "daily"
      ? await baseQuery.eq("date", day).order("clock_in_at", { ascending: false })
      : await baseQuery
          .gte("date", toDateStr(weekStart))
          .lte("date", toDateStr(weekEnd))
          .order("date", { ascending: false });

  const qs = (params: Record<string, string>) => new URLSearchParams(params).toString();

  return (
    <div>
      <PageHeader title={employee.full_name} subtitle={employee.job_role ?? "Attendance history"} />
      <Link href="/attendance" className="mb-4 inline-block text-sm font-semibold text-primary">
        ← All employees
      </Link>

      <div className="mb-[18px] flex w-fit gap-1.5 rounded-lg bg-bg p-1">
        <Link
          href={`/attendance/${employeeId}?${qs({ tab: "daily" })}`}
          className={`rounded-md px-4 py-2 text-sm font-bold ${tab === "daily" ? "bg-white text-primary shadow-sm" : "text-text-muted"}`}
        >
          Daily
        </Link>
        <Link
          href={`/attendance/${employeeId}?${qs({ tab: "weekly" })}`}
          className={`rounded-md px-4 py-2 text-sm font-bold ${tab === "weekly" ? "bg-white text-primary shadow-sm" : "text-text-muted"}`}
        >
          Weekly
        </Link>
      </div>

      <div className="mb-[18px] flex items-center justify-center gap-4">
        {tab === "daily" ? (
          <>
            <Link
              href={`/attendance/${employeeId}?${qs({ tab: "daily", date: addDays(day, -1) })}`}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-white text-text-dark"
            >
              ‹
            </Link>
            <div className="min-w-[220px] text-center text-[15px] font-bold text-text-dark">{selectedDayLabel}</div>
            <Link
              href={`/attendance/${employeeId}?${qs({ tab: "daily", date: addDays(day, 1) })}`}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-white text-text-dark"
            >
              ›
            </Link>
          </>
        ) : (
          <>
            <Link
              href={`/attendance/${employeeId}?${qs({ tab: "weekly", week: String(weekOffset - 1) })}`}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-white text-text-dark"
            >
              ‹
            </Link>
            <div className="min-w-[220px] text-center text-[15px] font-bold text-text-dark">{selectedWeekLabel}</div>
            <Link
              href={`/attendance/${employeeId}?${qs({ tab: "weekly", week: String(weekOffset + 1) })}`}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-border bg-white text-text-dark"
            >
              ›
            </Link>
          </>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          Couldn&apos;t load attendance — connect Supabase to see live data.
        </div>
      )}

      {!error && (records?.length ?? 0) === 0 ? (
        <EmptyState title={`No attendance records for this ${tab === "daily" ? "day" : "week"}`} />
      ) : (
        <Table
          head={[
            "Company",
            "Site",
            ...(tab === "weekly" ? ["Date"] : []),
            "Clock In",
            "Clock In Loc.",
            "Clock Out",
            "Clock Out Loc.",
            "Break",
            "Hours",
            "Status",
          ]}
        >
          {records?.map((r) => (
            <tr key={r.id} className="border-b border-border last:border-0">
              <td className="px-5 py-3.5 text-text-muted">{(r.companies as { name?: string } | null)?.name ?? "—"}</td>
              <td className="px-5 py-3.5 text-text-muted">{(r.sites as { name?: string } | null)?.name ?? "—"}</td>
              {tab === "weekly" && <td className="px-5 py-3.5 text-text-muted">{r.date}</td>}
              <td className="px-5 py-3.5 text-text-muted">{timeOf(r.clock_in_at)}</td>
              <td className="px-5 py-3.5">
                <LocationLink lat={r.clock_in_lat} lng={r.clock_in_lng} />
              </td>
              <td className="px-5 py-3.5 text-text-muted">{timeOf(r.clock_out_at)}</td>
              <td className="px-5 py-3.5">
                <LocationLink lat={r.clock_out_lat} lng={r.clock_out_lng} />
              </td>
              <td className="px-5 py-3.5 text-text-muted">{breakOf(r.total_break_minutes)}</td>
              <td className="px-5 py-3.5 text-text-muted">{hoursOf(r.clock_in_at, r.clock_out_at, r.total_break_minutes)}</td>
              <td className="px-5 py-3.5">
                <Badge tone={r.status === "complete" ? "success" : "warning"}>
                  {r.status === "complete" ? "Complete" : "In Progress"}
                </Badge>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
