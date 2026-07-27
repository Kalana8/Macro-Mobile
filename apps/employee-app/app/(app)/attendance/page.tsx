import { cookies } from "next/headers";
import { createClient } from "@macro/shared/supabase/server";
import { ScreenHeader } from "@/components/ui";
import { ACTIVE_SITE_COOKIE } from "@/lib/constants";
import { AttendanceClock } from "./AttendanceClock";
import { AttendanceHistory } from "./AttendanceHistory";

export default async function AttendancePage() {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Only the specific site confirmed at login (geofence-checked, pinned via
  // ACTIVE_SITE_COOKIE) is shown here — not every site the employee could
  // theoretically access. Clocking in always applies to that one site.
  const cookieStore = await cookies();
  const siteId = cookieStore.get(ACTIVE_SITE_COOKIE)?.value;

  const [{ data: site }, { data: activeRecord }, { data: history }] = await Promise.all([
    siteId
      ? supabase.from("sites").select("id, name, lat, lng, companies(name)").eq("id", siteId).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("attendance")
      .select("*")
      .eq("date", today)
      .neq("status", "complete")
      .order("clock_in_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("attendance")
      .select("id, date, clock_in_at, clock_out_at, total_break_minutes, status, sites(name)")
      .eq("status", "complete")
      .order("date", { ascending: false })
      .limit(10),
  ]);

  const company = site?.companies as { name?: string } | { name?: string }[] | null;
  const companyName = Array.isArray(company) ? company[0]?.name : company?.name;

  return (
    <div>
      <ScreenHeader title="Attendance" />
      <div className="flex flex-col gap-5 p-5">
        <AttendanceClock
          site={site ? { id: site.id, name: site.name, lat: site.lat, lng: site.lng, companyName: companyName ?? null } : null}
          activeRecord={activeRecord ?? null}
        />
        <AttendanceHistory records={history ?? []} />
      </div>
    </div>
  );
}
