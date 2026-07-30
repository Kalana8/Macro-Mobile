import { formatTime } from "@macro/shared/datetime";
import { Badge, Card, EmptyState } from "@/components/ui";

interface HistoryRecord {
  id: string;
  date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  total_break_minutes: number;
  status: string;
  sites: { name?: string } | { name?: string }[] | null;
}

function siteName(sites: HistoryRecord["sites"]): string {
  if (!sites) return "—";
  return Array.isArray(sites) ? (sites[0]?.name ?? "—") : (sites.name ?? "—");
}

function timeOf(iso: string | null): string {
  if (!iso) return "—";
  return formatTime(iso, { hour: "2-digit", minute: "2-digit" });
}

function hoursWorked(record: HistoryRecord): string {
  if (!record.clock_in_at || !record.clock_out_at) return "—";
  const ms =
    new Date(record.clock_out_at).getTime() -
    new Date(record.clock_in_at).getTime() -
    record.total_break_minutes * 60000;
  return `${(ms / 3600000).toFixed(1)}h`;
}

export function AttendanceHistory({ records }: { records: HistoryRecord[] }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
        Attendance History
      </div>
      {records.length === 0 ? (
        <EmptyState title="No completed shifts yet" hint="Your clocked-out shifts will show up here." />
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((record) => (
            <Card key={record.id} className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-text-dark">{siteName(record.sites)}</div>
                <div className="text-xs text-text-muted">
                  {record.date} · {timeOf(record.clock_in_at)}–{timeOf(record.clock_out_at)} · {hoursWorked(record)}
                </div>
              </div>
              <Badge tone="success">Complete</Badge>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
