import Link from "next/link";
import { createClient } from "@macro/shared/supabase/server";
import { todayInBusinessTimezone } from "@macro/shared/datetime";
import { Badge, Card, ScreenHeader } from "@/components/ui";
import { AttendanceClock } from "./AttendanceClock";
import { AttendanceHistory } from "./AttendanceHistory";

function companyNameOf(companies: { name?: string } | { name?: string }[] | null): string {
  const c = Array.isArray(companies) ? companies[0] : companies;
  return c?.name ?? "—";
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ siteId?: string }>;
}) {
  const { siteId: requestedSiteId } = await searchParams;
  const supabase = await createClient();
  const today = todayInBusinessTimezone();

  // No login-time site pinning anymore — the employee picks which site
  // they're at by navigating there from Home, and location is only
  // fetched/checked later, at Clock In (see attendance/actions.ts).
  const { data: assignedSites } = await supabase
    .from("sites")
    .select("id, name, address, lat, lng, companies(name)")
    .order("name");

  const siteId = requestedSiteId || (assignedSites?.length === 1 ? assignedSites[0].id : undefined);
  const site = siteId ? (assignedSites ?? []).find((s) => s.id === siteId) ?? null : null;

  // Multiple sites and none specified yet — ask which one before showing the clock card.
  if (!site && (assignedSites?.length ?? 0) > 1) {
    return (
      <div>
        <ScreenHeader title="Attendance" subtitle="Pick the site you're at" />
        <div className="flex flex-col gap-2 p-5">
          {assignedSites!.map((s) => (
            <Link key={s.id} href={`/attendance?siteId=${s.id}`}>
              <Card className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[14.5px] font-semibold text-text-dark">{s.name}</div>
                  <div className="text-xs text-text-muted">{companyNameOf(s.companies)}</div>
                </div>
                <Badge tone="neutral">Select</Badge>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Scoped to THIS site specifically — an employee can be clocked in at
  // more than one site at once, so a global (site-agnostic) lookup here
  // would show the wrong site's active record when they have several.
  const [{ data: activeRecord }, { data: history }] = await Promise.all([
    siteId
      ? supabase
          .from("attendance")
          .select("*")
          .eq("site_id", siteId)
          .eq("date", today)
          .neq("status", "complete")
          .order("clock_in_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("attendance")
      .select("id, date, clock_in_at, clock_out_at, total_break_minutes, status, sites(name)")
      .eq("status", "complete")
      .order("date", { ascending: false })
      .limit(10),
  ]);

  return (
    <div>
      <ScreenHeader title="Attendance" />
      <div className="flex flex-col gap-5 p-5">
        <AttendanceClock
          site={
            site
              ? { id: site.id, name: site.name, lat: site.lat, lng: site.lng, companyName: companyNameOf(site.companies) }
              : null
          }
          activeRecord={activeRecord ?? null}
        />
        <AttendanceHistory records={history ?? []} />
      </div>
    </div>
  );
}
