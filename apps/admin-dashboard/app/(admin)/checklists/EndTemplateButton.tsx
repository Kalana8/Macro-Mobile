"use client";

import { endTemplateAction } from "./actions";

/** Stops a repeating checklist immediately, modeled on the shared DeleteButton pattern (components/DeleteButton.tsx) but calling endTemplateAction instead of a delete. */
export function EndTemplateButton({ templateId, confirmText }: { templateId: string; confirmText: string }) {
  return (
    <form
      action={endTemplateAction}
      onSubmit={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={templateId} />
      <button
        type="submit"
        className="flex h-8 w-8 items-center justify-center rounded-lg bg-bg text-text-muted"
        aria-label="End Now"
        title="End Now"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="6" y="6" width="12" height="12" rx="1.5" />
        </svg>
      </button>
    </form>
  );
}
