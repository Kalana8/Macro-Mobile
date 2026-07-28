import { notFound } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";
import { Badge, Card, ScreenHeader } from "@/components/ui";
import type { ChecklistArea } from "@macro/shared/types";
import { ChecklistSubmitForm } from "./ChecklistSubmitForm";

export default async function ChecklistDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: checklist } = await supabase
    .from("checklists")
    .select("*, companies(name)")
    .eq("id", id)
    .maybeSingle();

  if (!checklist) notFound();

  const areas = (checklist.areas as ChecklistArea[]) ?? [];
  const companyName = (checklist.companies as { name?: string } | null)?.name ?? "—";
  const submitted = checklist.status === "submitted";

  return (
    <div>
      <ScreenHeader
        title={areas.map((a) => a.main_area).join(", ") || "Checklist"}
        subtitle={`${checklist.assigned_date} · ${companyName} · ${checklist.site}`}
      />
      <div className="flex flex-col gap-4 p-5">
        <div>
          <Badge tone={submitted ? "success" : "warning"}>
            {submitted ? "Submitted" : "Pending Review"}
          </Badge>
        </div>

        {checklist.admin_note && (
          <Card>
            <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Admin Note</div>
            <div className="mt-1 text-sm text-text-dark">{checklist.admin_note}</div>
          </Card>
        )}

        {submitted ? (
          <>
            {areas.map((area, i) => (
              <Card key={i}>
                <div className="mb-2 text-sm font-semibold text-text-dark">{area.main_area}</div>
                <div className="flex flex-col gap-2">
                  {area.subtasks.map((task) => (
                    <div key={task.id} className="flex items-center justify-between gap-2 text-sm text-text-dark">
                      <span>{task.text}</span>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                          task.done ? "bg-primary text-white" : "border border-border"
                        }`}
                      >
                        {task.done && "✓"}
                      </span>
                    </div>
                  ))}
                </div>
                {area.note && <div className="mt-2 text-xs text-text-muted">{area.note}</div>}
              </Card>
            ))}

            <Card>
              <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Notes</div>
              <div className="mt-1 text-sm text-text-dark">
                {checklist.notes || <span className="italic text-text-muted">No notes submitted.</span>}
              </div>
            </Card>

            {checklist.images.length > 0 && (
              <Card>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Images</div>
                <div className="flex flex-wrap gap-1.5">
                  {(checklist.images as string[]).map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={url} src={url} alt="Attachment" className="h-20 w-20 rounded-lg object-cover" />
                  ))}
                </div>
              </Card>
            )}
          </>
        ) : (
          <ChecklistSubmitForm checklistId={checklist.id} initialAreas={areas} initialNotes={checklist.notes ?? ""} />
        )}
      </div>
    </div>
  );
}
