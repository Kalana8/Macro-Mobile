import { createClient } from "@macro/shared/supabase/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { setDeletionRequestStatusAction } from "./actions";

export const dynamic = "force-dynamic";

interface DeletionRequest {
  id: string;
  username: string;
  requested_on: string;
  reason: string;
  status: "new" | "done";
  created_at: string;
  handled_at: string | null;
  handler: { full_name?: string } | { full_name?: string }[] | null;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-AU", { timeZone: "Australia/Melbourne", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * Requests from the website's "Delete your account" form
 * (macropropertyservices.com.au/delete-account), which the app's Profile →
 * Delete Account opens. Delete the employee on the Employees page, then mark
 * the request done here.
 */
export default async function DeletionRequestsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .select("id, username, requested_on, reason, status, created_at, handled_at, handler:employees!account_deletion_requests_handled_by_fkey(full_name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const requests = (data ?? []) as DeletionRequest[];
  const open = requests.filter((r) => r.status === "new");
  const done = requests.filter((r) => r.status === "done");
  const missing = !!error && /account_deletion_requests/.test(error.message);

  return (
    <div>
      <PageHeader
        title="Delete Account Requests"
        subtitle="From the Delete Account form on the website. Delete the employee on the Employees page, then mark the request done."
      />

      {missing && (
        <div className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          Requests can&apos;t be received yet: run migration 0070 (account_deletion_requests) in the Supabase SQL editor.
        </div>
      )}
      {error && !missing && (
        <div className="mb-4 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">Couldn&apos;t load the requests. Refresh to try again.</div>
      )}

      {!error && requests.length === 0 && <EmptyState title="No requests yet" hint="Requests sent from the website's Delete Account form show here." />}

      {[
        { label: "NEW", list: open },
        { label: "DONE", list: done },
      ]
        .filter((g) => g.list.length > 0)
        .map((g) => (
          <div key={g.label} className="mb-6">
            <div className="mb-2 text-[11px] font-bold tracking-wide text-text-muted">
              {g.label} · {g.list.length}
            </div>
            <div className="flex flex-col gap-3">
              {g.list.map((r) => {
                const handler = Array.isArray(r.handler) ? r.handler[0] : r.handler;
                return (
                  <Card key={r.id}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="break-all text-[15px] font-extrabold text-text-dark">{r.username}</span>
                          {r.status === "new" ? <Badge tone="warning">New</Badge> : <Badge tone="success">Done</Badge>}
                        </div>
                        <div className="mt-1 text-xs text-text-muted">
                          Date given: {r.requested_on} · Received {when(r.created_at)}
                          {r.status === "done" && r.handled_at ? ` · Done ${when(r.handled_at)}${handler?.full_name ? ` by ${handler.full_name}` : ""}` : ""}
                        </div>
                        <div className="mt-2.5 rounded-lg bg-bg px-3 py-2.5">
                          <div className="text-[11px] font-bold tracking-wide text-text-muted">REASON</div>
                          <div className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] text-text-dark">{r.reason || "—"}</div>
                        </div>
                      </div>
                      <form action={setDeletionRequestStatusAction} className="shrink-0">
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="status" value={r.status === "new" ? "done" : "new"} />
                        <button
                          type="submit"
                          className={`rounded-[10px] px-3.5 py-2 text-[12.5px] font-bold ${r.status === "new" ? "bg-primary text-white" : "border border-border text-text-muted"}`}
                        >
                          {r.status === "new" ? "Mark done" : "Reopen"}
                        </button>
                      </form>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}
