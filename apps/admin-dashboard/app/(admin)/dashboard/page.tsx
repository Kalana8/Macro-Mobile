import Link from "next/link";
import { createClient } from "@macro/shared/supabase/server";
import { Badge, Card, PageHeader } from "@/components/ui";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfWeek(offsetWeeks: number): Date {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  d.setUTCDate(d.getUTCDate() - d.getUTCDay() + offsetWeeks * 7);
  return d;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function timeOf(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const weekOffset = Number(week ?? 0) || 0;

  const supabase = await createClient();
  const today = toDateStr(new Date());
  const weekStart = startOfWeek(weekOffset);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });
  const weekLabel =
    weekOffset === 0
      ? "This Week"
      : weekOffset === -1
        ? "Last Week"
        : weekOffset === 1
          ? "Next Week"
          : `${weekDates[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekDates[6].toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;

  const [
    { count: submitAudits },
    { count: verifyAudits },
    { count: completedAudits },
    { data: weekAttendance },
    { data: todaysAttendance },
    { data: todaysChecklists },
    { data: allChecklists },
    { data: allEmployees },
    { data: memberships },
    { data: recentCommunications },
    { data: recentCommRecipients },
  ] = await Promise.all([
    supabase.from("audits").select("*", { count: "exact", head: true }).eq("status", "submit"),
    supabase.from("audits").select("*", { count: "exact", head: true }).eq("status", "verify"),
    supabase.from("audits").select("*", { count: "exact", head: true }).eq("status", "complete"),
    supabase
      .from("attendance")
      .select("date")
      .gte("date", toDateStr(weekDates[0]))
      .lte("date", toDateStr(weekDates[6])),
    supabase
      .from("attendance")
      .select("employee_id, clock_in_at, clock_out_at, employees(full_name), companies(name), sites(name)")
      .eq("date", today),
    supabase.from("checklists").select("employee_id, status").eq("assigned_date", today),
    supabase.from("checklists").select("employee_id, status"),
    supabase.from("employees").select("id, full_name").order("full_name"),
    supabase.from("employee_companies").select("employee_id, companies(name)"),
    supabase
      .from("communications")
      .select("id, title, priority, status, companies(name)")
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("communication_recipients").select("communication_id, employees(full_name)"),
  ]);

  const attendanceByDay = weekDates.map((d) => {
    const dateStr = toDateStr(d);
    const count = (weekAttendance ?? []).filter((r) => r.date === dateStr).length;
    return { label: DAY_LABELS[d.getUTCDay()], count };
  });
  const maxDayCount = Math.max(1, ...attendanceByDay.map((d) => d.count));

  const auditBars = [
    { label: "Submit", count: submitAudits ?? 0, color: "var(--color-orange)" },
    { label: "Verify", count: verifyAudits ?? 0, color: "var(--color-olive-text)" },
    { label: "Complete", count: completedAudits ?? 0, color: "var(--color-primary)" },
  ];
  const maxAuditCount = Math.max(1, ...auditBars.map((b) => b.count));

  const checklistByEmployee = new Map<string, string>();
  for (const c of todaysChecklists ?? []) {
    checklistByEmployee.set(c.employee_id, c.status);
  }

  const checklistTableRows = (todaysAttendance ?? []).slice(0, 8).map((a) => ({
    employee: (a.employees as { full_name?: string } | null)?.full_name ?? "—",
    company: (a.companies as { name?: string } | null)?.name ?? "—",
    site: (a.sites as { name?: string } | null)?.name ?? "—",
    clockIn: timeOf(a.clock_in_at),
    clockOut: timeOf(a.clock_out_at),
    status: checklistByEmployee.get(a.employee_id),
  }));

  const companyNamesByEmployee = new Map<string, string[]>();
  for (const m of memberships ?? []) {
    const name = (m.companies as { name?: string } | null)?.name;
    if (!name) continue;
    const list = companyNamesByEmployee.get(m.employee_id) ?? [];
    list.push(name);
    companyNamesByEmployee.set(m.employee_id, list);
  }
  const checklistCountsByEmployee = new Map<string, { total: number; submitted: number }>();
  for (const c of allChecklists ?? []) {
    const existing = checklistCountsByEmployee.get(c.employee_id) ?? { total: 0, submitted: 0 };
    existing.total += 1;
    if (c.status === "submitted") existing.submitted += 1;
    checklistCountsByEmployee.set(c.employee_id, existing);
  }
  const employeeChecklistRows = (allEmployees ?? []).map((e) => {
    const counts = checklistCountsByEmployee.get(e.id);
    return {
      name: e.full_name,
      company: (companyNamesByEmployee.get(e.id) ?? []).join(", ") || "—",
      summary: counts ? `${counts.submitted}/${counts.total} submitted` : "No checklists",
    };
  });

  const employeeNamesByCommunication = new Map<string, string[]>();
  for (const r of recentCommRecipients ?? []) {
    const name = (r.employees as { full_name?: string } | null)?.full_name;
    if (!name) continue;
    const list = employeeNamesByCommunication.get(r.communication_id) ?? [];
    list.push(name);
    employeeNamesByCommunication.set(r.communication_id, list);
  }
  const communicationRows = (recentCommunications ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    priority: c.priority as "low" | "medium" | "high",
    status: c.status as "open" | "closed",
    companyName: (c.companies as { name?: string } | null)?.name ?? "—",
    employeeNames: (employeeNamesByCommunication.get(c.id) ?? []).join(", ") || "—",
  }));
  const PRIORITY_TONE = { low: "neutral", medium: "warning", high: "error" } as const;

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview across all companies" />

      <div className="grid grid-cols-[1.3fr_1fr] gap-5">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-bold text-text-dark">Attendance</div>
            <div className="flex items-center gap-2.5">
              <Link
                href={`/dashboard?week=${weekOffset - 1}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg text-text-dark"
              >
                ‹
              </Link>
              <div className="min-w-[90px] text-center text-xs font-semibold text-text-muted">{weekLabel}</div>
              <Link
                href={`/dashboard?week=${weekOffset + 1}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg text-text-dark"
              >
                ›
              </Link>
            </div>
          </div>
          <div className="flex h-[150px] items-end gap-3.5">
            {attendanceByDay.map((bar) => (
              <div key={bar.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="text-[11px] font-bold text-text-dark">{bar.count}</div>
                <div
                  className="w-full max-w-[34px] rounded-t-lg rounded-b-sm bg-primary"
                  style={{ height: `${Math.max(4, (bar.count / maxDayCount) * 110)}px` }}
                />
                <div className="text-[11px] text-text-muted">{bar.label}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="mb-4 text-sm font-bold text-text-dark">Audit Status</div>
          <div className="flex h-[150px] items-end gap-3.5">
            {auditBars.map((bar) => (
              <div key={bar.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="text-[11px] font-bold text-text-dark">{bar.count}</div>
                <div
                  className="w-full max-w-[44px] rounded-t-lg rounded-b-sm"
                  style={{ height: `${Math.max(4, (bar.count / maxAuditCount) * 110)}px`, background: bar.color }}
                />
                <div className="text-[11px] text-text-muted">{bar.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-5">
        <div className="mb-4 text-sm font-bold text-text-dark">Employee Checklists</div>
        <div className="mb-4 flex flex-col gap-2.5">
          {employeeChecklistRows.length === 0 ? (
            <div className="text-xs text-text-muted">No employees yet.</div>
          ) : (
            employeeChecklistRows.map((row, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-bg px-3.5 py-2.5">
                <div>
                  <div className="text-[13px] font-semibold text-text-dark">{row.name}</div>
                  <div className="text-[11.5px] text-text-muted">{row.company}</div>
                </div>
                <div className="text-xs font-semibold text-text-muted">{row.summary}</div>
              </div>
            ))
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg">
                {["Employee", "Company", "Site", "Clock In", "Clock Out", "Checklist"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-[11px] font-bold text-text-muted">{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {checklistTableRows.length === 0 ? (
                <tr><td colSpan={6} className="px-3 py-4 text-center text-xs text-text-muted">No attendance recorded today.</td></tr>
              ) : (
                checklistTableRows.map((row, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-3 py-2.5 text-[12.5px] font-semibold text-text-dark">{row.employee}</td>
                    <td className="px-3 py-2.5 text-[12.5px] text-text-muted">{row.company}</td>
                    <td className="px-3 py-2.5 text-[12.5px] text-text-muted">{row.site}</td>
                    <td className="px-3 py-2.5 text-[12.5px] text-text-muted">{row.clockIn}</td>
                    <td className="px-3 py-2.5 text-[12.5px] text-text-muted">{row.clockOut}</td>
                    <td className="px-3 py-2.5">
                      {row.status ? (
                        <Badge tone={row.status === "submitted" ? "success" : "warning"}>{row.status}</Badge>
                      ) : (
                        <span className="text-[11px] text-text-muted">none assigned</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="text-sm font-bold text-text-dark">Recent Communications</div>
          <Link href="/communication" className="text-xs font-semibold text-primary">
            View all
          </Link>
        </div>
        {communicationRows.length === 0 ? (
          <div className="text-xs text-text-muted">No communications yet.</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {communicationRows.map((c) => (
              <Link
                key={c.id}
                href="/communication"
                className="flex items-center justify-between rounded-lg bg-bg px-3.5 py-2.5"
              >
                <div>
                  <div className="text-[13px] font-semibold text-text-dark">{c.title}</div>
                  <div className="text-[11.5px] text-text-muted">{c.companyName} · {c.employeeNames}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge tone={PRIORITY_TONE[c.priority]}>{c.priority}</Badge>
                  <Badge tone={c.status === "open" ? "info" : "neutral"}>{c.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
