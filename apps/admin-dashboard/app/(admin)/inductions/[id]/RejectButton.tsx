"use client";

import { useRef } from "react";
import { rejectSubmissionAction } from "../actions";

/** A plain <form action> can't prompt for a reason first — needs client interactivity to gate the submit on a confirm/prompt. */
export function RejectButton({ submissionId }: { submissionId: string }) {
  const noteRef = useRef<HTMLInputElement>(null);

  return (
    <form
      action={rejectSubmissionAction}
      onSubmit={(e) => {
        const reason = window.prompt("Reason for rejecting this submission (optional):");
        if (reason === null) {
          e.preventDefault();
          return;
        }
        if (noteRef.current) noteRef.current.value = reason;
      }}
    >
      <input type="hidden" name="submissionId" value={submissionId} />
      <input ref={noteRef} type="hidden" name="reviewNote" defaultValue="" />
      <button type="submit" className="rounded-[11px] border border-error/40 bg-error/10 px-4 py-2.5 text-sm font-bold text-error">
        Reject
      </button>
    </form>
  );
}
