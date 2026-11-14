export type AttendanceStatus = "clocked_in" | "on_break" | "complete";

export interface TodayRecord {
  employee_id: string;
  company_id: string;
  site_id: string;
  status: AttendanceStatus;
  clock_in_at: string | null;
  sites: { name?: string } | { name?: string }[] | null;
}

export interface SiteStatus {
  siteId: string;
  siteName: string;
  status: AttendanceStatus;
}

/**
 * Today's status for each site, grouped by employee and company. An employee can
 * be on shift at several sites at once, each with its own break, so one status
 * per employee would show a break at one site against all the others.
 */
export function groupTodayStatuses(records: TodayRecord[]): Map<string, SiteStatus[]> {
  const latest = new Map<string, TodayRecord>();
  for (const r of records) {
    const key = `${r.employee_id}:${r.company_id}:${r.site_id}`;
    const seen = latest.get(key);
    if (!seen || (r.clock_in_at ?? "") > (seen.clock_in_at ?? "")) latest.set(key, r);
  }

  const grouped = new Map<string, SiteStatus[]>();
  for (const r of latest.values()) {
    const site = Array.isArray(r.sites) ? r.sites[0] : r.sites;
    const key = statusKey(r.employee_id, r.company_id);
    grouped.set(key, [...(grouped.get(key) ?? []), { siteId: r.site_id, siteName: site?.name ?? "Site", status: r.status }]);
  }
  return grouped;
}

export const statusKey = (employeeId: string, companyId: string) => `${employeeId}:${companyId}`;

export function statusLabel(status: AttendanceStatus): string {
  return status === "complete" ? "Clocked Out" : status === "on_break" ? "On Break" : "Clocked In";
}
