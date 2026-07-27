import Link from "next/link";
import { createClient } from "@macro/shared/supabase/server";
import { Badge, Card, EmptyState, ScreenHeader } from "@/components/ui";

const STATUS_TONE = {
  submit: "info",
  verify: "warning",
  complete: "success",
} as const;

const STATUS_LABEL = {
  submit: "Submit",
  verify: "Verify",
  complete: "Complete",
} as const;

export default async function AuditsPage() {
  const supabase = await createClient();
  const { data: audits, error } = await supabase
    .from("audits")
    .select("id, title, date, status, location, final_marks, max_marks, companies(name)")
    .order("date", { ascending: false });

  return (
    <div>
      <ScreenHeader title="Audits" subtitle="Your submitted and assigned audits" />
      <div className="flex flex-col gap-3 p-5">
        <Link
          href="/audits/new"
          className="rounded-lg bg-orange px-4 py-3 text-center text-sm font-bold text-white"
        >
          + New Audit
        </Link>

        {error && (
          <div className="rounded-lg bg-error/10 px-3 py-2 text-[12.5px] text-error">
            Couldn&apos;t load audits — connect Supabase to see live data.
          </div>
        )}

        {!error && (audits?.length ?? 0) === 0 && (
          <EmptyState title="No audits yet" hint="Submit your first audit with the button above." />
        )}

        {audits?.map((audit) => {
          const status = audit.status as keyof typeof STATUS_TONE;
          const companyName = (audit.companies as { name?: string } | null)?.name ?? "—";
          return (
            <Link key={audit.id} href={`/audits/${audit.id}`}>
              <Card>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-text-dark">{audit.title || "Untitled audit"}</div>
                    <div className="text-xs text-text-muted">
                      {audit.date} · {companyName} · {audit.location || "—"}
                    </div>
                  </div>
                  <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? audit.status}</Badge>
                </div>
                {status === "complete" && audit.final_marks != null ? (
                  <div className="mt-2 text-xs font-semibold text-primary">
                    Marks {audit.final_marks} / {audit.max_marks}
                  </div>
                ) : status === "complete" ? (
                  <div className="mt-2 text-xs italic text-text-muted">Awaiting results from admin</div>
                ) : null}
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
