import { notFound } from "next/navigation";
import { createClient } from "@macro/shared/supabase/server";
import { Badge, Card, ScreenHeader } from "@/components/ui";
import type { AuditMainItem, AuditRating } from "@macro/shared/types";

const STATUS_TONE = { submit: "info", verify: "warning", complete: "success" } as const;
const STATUS_LABEL = { submit: "Pending", verify: "Saved", complete: "Complete" } as const;
const PRIORITY_TONE = { low: "neutral", medium: "info", high: "error" } as const;
const RATING_TONE: Record<AuditRating, "neutral" | "error" | "warning" | "success"> = {
  "": "neutral",
  not_satisfactory: "error",
  satisfactory: "warning",
  good: "success",
};
const RATING_LABEL: Record<AuditRating, string> = {
  "": "Not rated",
  not_satisfactory: "Not Satisfactory",
  satisfactory: "Satisfactory",
  good: "Good",
};

export default async function AuditDetailPage({
  params,
}: {
  params: Promise<{ auditId: string }>;
}) {
  const { auditId } = await params;
  const supabase = await createClient();

  // RLS (audits_self_select) already scopes this to the signed-in
  // employee's own submissions — there's nothing else to authorize here.
  const { data: audit } = await supabase
    .from("audits")
    .select("*, companies(name)")
    .eq("id", auditId)
    .maybeSingle();

  if (!audit) notFound();

  const companyName = (audit.companies as { name?: string } | null)?.name ?? "—";
  const status = audit.status as keyof typeof STATUS_TONE;
  const priority = audit.priority as keyof typeof PRIORITY_TONE;
  const mainAudits = audit.main_audits as AuditMainItem[];

  return (
    <div>
      <ScreenHeader title={audit.title || "Untitled audit"} subtitle={`${companyName} · ${audit.date}`} />
      <div className="flex flex-col gap-4 p-5">
        <Card>
          <div className="flex items-center justify-between">
            <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? audit.status}</Badge>
            <Badge tone={PRIORITY_TONE[priority] ?? "neutral"}>{priority} priority</Badge>
          </div>

          {audit.location && (
            <div className="mt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Location</div>
              <div className="text-sm text-text-dark">{audit.location}</div>
            </div>
          )}
          {audit.description && (
            <div className="mt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Description</div>
              <div className="text-sm text-text-dark">{audit.description}</div>
            </div>
          )}
          {audit.notes && (
            <div className="mt-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-text-muted">Notes</div>
              <div className="text-sm text-text-dark">{audit.notes}</div>
            </div>
          )}
        </Card>

        {status === "complete" && (
          <Card className="flex items-center justify-between">
            <div className="text-sm font-bold text-text-dark">Final Marks</div>
            {audit.final_marks != null ? (
              <div className="text-lg font-extrabold text-primary">
                {audit.final_marks} <span className="text-sm font-semibold text-text-muted">/ {audit.max_marks}</span>
              </div>
            ) : (
              <div className="text-xs italic text-text-muted">Awaiting results from admin</div>
            )}
          </Card>
        )}

        {mainAudits.length > 0 && (
          <div className="flex flex-col gap-3">
            {mainAudits.map((ma) => (
              <Card key={ma.id}>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-bold text-text-dark">{ma.title || "Untitled section"}</div>
                  {ma.marks != null && <div className="text-sm font-extrabold text-primary">{ma.marks} pts</div>}
                </div>

                {ma.sub_audits.length > 0 && (
                  <div className="mt-2.5 flex flex-col gap-1.5">
                    {ma.sub_audits.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between gap-2 rounded-lg bg-bg px-3 py-2">
                        <div className="text-[13px] text-text-dark">{sub.text || "Untitled item"}</div>
                        <Badge tone={RATING_TONE[sub.result]}>{RATING_LABEL[sub.result]}</Badge>
                      </div>
                    ))}
                  </div>
                )}

                {ma.comment && <div className="mt-2.5 text-xs text-text-muted">{ma.comment}</div>}

                {ma.images.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {ma.images.map((url) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={url} src={url} alt="Attachment" className="h-16 w-16 rounded-lg object-cover" />
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
