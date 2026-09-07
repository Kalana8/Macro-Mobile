"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, EmptyState, PlusIcon, PrimaryButton } from "@/components/ui";
import { formatDate } from "@macro/shared/datetime";
import { deleteTemplateAction, duplicateTemplateAction, setTemplateStatusAction } from "./actions";
import { NewTemplateModal } from "./NewTemplateModal";
import type { TemplateRow } from "./page";

function DeleteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  );
}

export function TemplatesGrid({ rows }: { rows: TemplateRow[] }) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <PrimaryButton onClick={() => setShowNew(true)}>
          <PlusIcon />
          Create Assignment
        </PrimaryButton>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No assignments yet" hint="Create one to start sending induction invitations." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => {
            const questionCount = t.sections.reduce((sum, s) => sum + s.questions.length, 0);
            return (
              <div key={t.id} className="flex flex-col rounded-[16px] border border-border bg-white p-4">
                <div className="mb-1.5 flex items-start justify-between gap-2">
                  <div className="text-[15px] font-bold text-text-dark">{t.name}</div>
                  <Badge tone={t.status === "published" ? "success" : "neutral"}>{t.status === "published" ? "Published" : "Draft"}</Badge>
                </div>
                {t.category && <div className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">{t.category}</div>}
                <div className="mt-1 text-[11.5px] text-text-muted">
                  {t.sections.length} section{t.sections.length === 1 ? "" : "s"} · {questionCount} question{questionCount === 1 ? "" : "s"} · used in{" "}
                  {t.usageCount} invitation{t.usageCount === 1 ? "" : "s"}
                </div>
                <div className="text-[11.5px] text-text-muted">
                  Owner {t.ownerName} · updated {formatDate(t.updated_at, { day: "numeric", month: "short", year: "numeric" })}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/inductions/templates/${t.id}`)}
                    className="flex-1 rounded-[10px] border border-border py-2.5 text-[12.5px] font-bold text-text-dark"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/inductions?newFromTemplate=${t.id}`)}
                    className="flex-1 rounded-[10px] bg-primary py-2.5 text-[12.5px] font-bold text-white"
                  >
                    Use
                  </button>
                  <form action={duplicateTemplateAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="rounded-[10px] border border-border px-3 py-2.5 text-[12.5px] font-bold text-text-dark" title="Duplicate">
                      Duplicate
                    </button>
                  </form>
                  <form action={setTemplateStatusAction}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="status" value={t.status === "published" ? "draft" : "published"} />
                    <button type="submit" className="rounded-[10px] border border-border px-3 py-2.5 text-[12.5px] font-bold text-text-dark">
                      {t.status === "published" ? "Unpublish" : "Publish"}
                    </button>
                  </form>
                  <form
                    action={deleteTemplateAction}
                    onSubmit={(e) => {
                      if (!window.confirm(`Delete "${t.name}"? Invitations already created from it keep working.`)) e.preventDefault();
                    }}
                  >
                    <input type="hidden" name="id" value={t.id} />
                    <button type="submit" className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-bg text-error" aria-label="Delete" title="Delete">
                      <DeleteIcon />
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && <NewTemplateModal onClose={() => setShowNew(false)} />}
    </div>
  );
}
