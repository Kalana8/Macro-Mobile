"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setChecklistPairAction } from "./actions";

/**
 * Pairs this person with someone else on the same checklist: when either
 * submits it, the other's copy for that day is submitted too.
 */
export function PairSelect({
  assignmentId,
  pairId,
  options,
}: {
  assignmentId: string;
  pairId: string | null;
  /** Others assigned the same checklist. */
  options: { assignmentId: string; name: string; pairId: string | null }[];
}) {
  const router = useRouter();
  const [saving, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const current = pairId ? options.find((o) => o.pairId === pairId)?.assignmentId ?? "" : "";

  if (options.length === 0) return <span className="text-[12px] text-text-muted">No one else on this checklist</span>;
  return (
    <div>
      <select
        aria-label="Pair with"
        value={current}
        disabled={saving}
        onChange={(e) => {
          const partner = e.target.value || null;
          const name = options.find((o) => o.assignmentId === partner)?.name;
          if (partner && !window.confirm(`Pair with ${name}? When either of them submits this checklist, it's submitted for both.`)) return;
          start(async () => {
            setError(null);
            const res = await setChecklistPairAction(assignmentId, partner);
            if (res.error) setError(res.error);
            else router.refresh();
          });
        }}
        className={`rounded-[10px] border px-2.5 py-1.5 text-[12.5px] font-semibold outline-none ${current ? "border-primary bg-primary/5 text-primary" : "border-border bg-bg text-text-dark"}`}
      >
        <option value="">Not paired</option>
        {options.map((o) => (
          <option key={o.assignmentId} value={o.assignmentId}>
            Paired with {o.name}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-[11px] text-error-text">{error}</p>}
    </div>
  );
}
