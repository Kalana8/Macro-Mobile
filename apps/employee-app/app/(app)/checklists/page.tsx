import Link from "next/link";
import { createClient } from "@macro/shared/supabase/server";
import { Badge, Card, EmptyState, ScreenHeader } from "@/components/ui";
import type { ChecklistArea } from "@macro/shared/types";

export default async function ChecklistsPage() {
  const supabase = await createClient();
  const { data: checklists, error } = await supabase
    .from("checklists")
    .select("id, site, assigned_date, status, areas, companies(name)")
    .order("assigned_date", { ascending: false });

  return (
    <div>
      <ScreenHeader title="Checklist" subtitle="Daily checklists sent by admin" />
      <div className="flex flex-col gap-3 p-5">
        {error && (
          <div className="rounded-lg bg-error/10 px-3 py-2 text-[12.5px] text-error">
            Couldn&apos;t load checklists — connect Supabase to see live data.
          </div>
        )}

        {!error && (checklists?.length ?? 0) === 0 && (
          <EmptyState title="No checklists assigned" hint="Your admin hasn't assigned any checklists yet." />
        )}

        {checklists?.map((checklist) => {
          const areas = (checklist.areas as ChecklistArea[]) ?? [];
          const title = areas.map((a) => a.main_area).join(", ") || "Checklist";
          const companyName = (checklist.companies as { name?: string } | null)?.name ?? "—";
          return (
            <Link key={checklist.id} href={`/checklists/${checklist.id}`}>
              <Card>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-text-muted">{checklist.assigned_date} · {companyName}</div>
                    <div className="text-sm font-semibold text-text-dark">{title}</div>
                    <div className="text-xs text-text-muted">{checklist.site}</div>
                  </div>
                  <Badge tone={checklist.status === "submitted" ? "success" : "warning"}>
                    {checklist.status === "submitted" ? "Submitted" : "Pending Review"}
                  </Badge>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
