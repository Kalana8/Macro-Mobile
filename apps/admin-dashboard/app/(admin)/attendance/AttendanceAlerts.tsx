import Link from "next/link";
import { formatDate, formatTime } from "@macro/shared/datetime";
import { Badge, Card } from "@/components/ui";

export interface AttendanceAlert {
  id: string;
  kind: "left_site" | "no_clock_in";
  employee_id: string;
  date: string;
  created_at: string;
  distance_m: number | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  employees: { full_name: string } | null;
  sites: { name: string } | null;
  companies: { name: string } | null;
}

/**
 * The last 7 days' attendance alerts (migration 0073): people clocked out
 * automatically because they left the site, with where they were and how far
 * away; and people who hadn't clocked in by the site's clock-in time.
 */
export function AttendanceAlerts({ alerts }: { alerts: AttendanceAlert[] }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="text-[15px] font-bold text-text-dark">Attendance alerts</div>
        <div className="text-[12px] text-text-muted">Last 7 days</div>
      </div>
      {alerts.length === 0 ? (
        <div className="text-[13px] text-text-muted">No one left a site while clocked in, and everyone clocked in on time.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11.5px] font-bold uppercase text-text-muted">
                <th className="py-2 pr-4">Alert</th>
                <th className="py-2 pr-4">Employee</th>
                <th className="py-2 pr-4">Site</th>
                <th className="py-2 pr-4">When</th>
                <th className="py-2 pr-4">Distance from site</th>
                <th className="py-2">Where they were</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 align-top">
                  <td className="py-2.5 pr-4">
                    <Badge tone={a.kind === "left_site" ? "error" : "warning"}>{a.kind === "left_site" ? "Left site · clocked out" : "Not clocked in"}</Badge>
                  </td>
                  <td className="py-2.5 pr-4 font-semibold text-text-dark">
                    <Link href={`/attendance/${a.employee_id}`} className="hover:underline">
                      {a.employees?.full_name ?? "—"}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4 text-text-muted">{[a.companies?.name, a.sites?.name].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="py-2.5 pr-4 text-text-muted">
                    {formatDate(a.created_at, { weekday: "short", day: "numeric", month: "short" })}
                    {a.kind === "left_site" ? `, ${formatTime(a.created_at, { hour: "numeric", minute: "2-digit" })}` : ""}
                  </td>
                  <td className="py-2.5 pr-4 font-semibold text-error-text">{a.distance_m != null ? `${Math.round(a.distance_m)} m away` : "—"}</td>
                  <td className="py-2.5 text-text-muted">
                    {a.lat != null && a.lng != null ? (
                      <a href={`https://www.google.com/maps?q=${a.lat},${a.lng}`} target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">
                        {a.address || `${a.lat.toFixed(5)}, ${a.lng.toFixed(5)}`} ↗
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
