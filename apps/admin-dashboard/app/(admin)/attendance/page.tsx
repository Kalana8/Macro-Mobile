import { createClient } from "@macro/shared/supabase/server";
import { businessDayRange, todayInBusinessTimezone } from "@macro/shared/datetime";
import { PageHeader } from "@/components/ui";
import { groupTodayStatuses, type SiteStatus, type TodayRecord } from "@/lib/attendanceStatus";
import { AttendanceList, type AttendancePerson } from "./AttendanceList";
import { AttendanceAlerts, type AttendanceAlert } from "./AttendanceAlerts";

export default async function AttendancePage() {
  const supabase = await createClient();
  const today = businessDayRange(todayInBusinessTimezone());

  // The last 7 days, by business date.
  const weekAgo = new Date(Date.parse(`${todayInBusinessTimezone()}T00:00:00Z`) - 6 * 86400000).toISOString().slice(0, 10);
  const [{ data: companies }, { data: memberships }, { data: employees }, { data: todayRecords }, alertsRes] =
    await Promise.all([
      supabase.from("companies").select("id, name").order("name"),
      supabase.from("employee_companies").select("employee_id, company_id"),
      supabase.from("employees").select("id, full_name, job_role").order("full_name"),
      supabase.from("attendance").select("employee_id, company_id, site_id, status, clock_in_at, sites(name)").gte("clock_in_at", today.start).lt("clock_in_at", today.end),
      supabase
        .from("attendance_alerts")
        .select("id, kind, employee_id, date, created_at, distance_m, lat, lng, address, employees(full_name), sites(name), companies(name)")
        .gte("date", weekAgo)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

  const companyIdsByEmployee: Record<string, string[]> = {};
  for (const m of memberships ?? []) (companyIdsByEmployee[m.employee_id] ??= []).push(m.company_id);

  const people: AttendancePerson[] = (employees ?? []).map((e) => ({
    id: e.id,
    full_name: e.full_name,
    job_role: e.job_role ?? null,
    companyIds: companyIdsByEmployee[e.id] ?? [],
  }));

  // Maps don't cross to client components, so send the statuses as a plain object.
  const statuses: Record<string, SiteStatus[]> = Object.fromEntries(groupTodayStatuses((todayRecords ?? []) as unknown as TodayRecord[]));

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Sort by company or employee name, pick an employee for their daily and weekly attendance, or create a report" />
      {/* Before migration 0073 there's no alerts table: leave the card out. */}
      {!alertsRes.error && (
        <div className="mb-4">
          <AttendanceAlerts alerts={(alertsRes.data ?? []) as unknown as AttendanceAlert[]} />
        </div>
      )}
      <AttendanceList companies={companies ?? []} people={people} statuses={statuses} />
    </div>
  );
}
