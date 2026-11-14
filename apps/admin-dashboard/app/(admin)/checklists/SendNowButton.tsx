"use client";

import { useState } from "react";
import { sendAssignmentNowAction } from "./actions";

/** Sends today's checklist for one standing assignment right away, and says what happened. */
export function SendNowButton({ assignmentId, employeeName }: { assignmentId: string; employeeName: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={busy}
        aria-label={`Send today’s checklist to ${employeeName} now`}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          const r = await sendAssignmentNowAction(assignmentId);
          setBusy(false);
          setMessage(r.error ? { text: r.error, error: true } : { text: r.message ?? "Sent." });
        }}
        className="rounded-[9px] bg-primary px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send now"}
      </button>
      {message && <span className={`text-[11px] ${message.error ? "text-error-text" : "text-text-muted"}`}>{message.text}</span>}
    </div>
  );
}
