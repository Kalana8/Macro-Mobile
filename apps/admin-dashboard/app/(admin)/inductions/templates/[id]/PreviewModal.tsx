"use client";

import { useState } from "react";
import { QuestionInput } from "@/components/QuestionInput";
import type { InductionAnswerValue, InductionFormSection } from "@macro/shared/types";

/**
 * Shows exactly what the employee will see — interactive (answers can be
 * typed/selected/toggled) but nothing here is ever saved; there's no submit
 * action, just a "Close Preview" affordance.
 */
export function PreviewModal({
  title,
  description,
  sections,
  onClose,
}: {
  title: string;
  description: string;
  sections: InductionFormSection[];
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, InductionAnswerValue>>({});
  const [triedSubmit, setTriedSubmit] = useState(false);

  function setAnswer(questionId: string, value: InductionAnswerValue) {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  }

  function isEmpty(value: InductionAnswerValue): boolean {
    if (value === null || value === undefined) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === "string") return value.trim() === "";
    return false;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-[rgba(22,32,46,0.45)]">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white px-5 py-3.5">
        <div className="text-sm font-bold text-text-dark">Preview — this is what the employee sees</div>
        <button type="button" onClick={onClose} className="rounded-[10px] bg-bg px-4 py-2 text-[12.5px] font-bold text-text-dark">
          Close Preview
        </button>
      </div>

      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <div className="mb-4 rounded-[16px] border-t-8 border-primary bg-white p-5">
          <div className="text-xl font-extrabold text-text-dark">{title || "Untitled Assignment"}</div>
          {description && <div className="mt-1.5 text-sm text-text-muted">{description}</div>}
        </div>

        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <div key={section.id} className="rounded-[16px] bg-white p-5">
              <div className="mb-1 text-[15px] font-bold text-text-dark">{section.title || "Untitled Section"}</div>
              {section.description && <div className="mb-4 text-xs text-text-muted">{section.description}</div>}

              <div className="flex flex-col gap-5">
                {section.questions.map((q) => {
                  const invalid = triedSubmit && q.required && isEmpty(answers[q.id] ?? null);
                  return (
                    <div key={q.id}>
                      <label className="mb-1.5 block text-sm font-semibold text-text-dark">
                        {q.title || "Untitled question"}
                        {q.required && <span className="ml-1 text-error">*</span>}
                      </label>
                      {q.description && <p className="mb-1.5 text-xs text-text-muted">{q.description}</p>}
                      <QuestionInput question={q} value={answers[q.id] ?? null} onChange={(v) => setAnswer(q.id, v)} invalid={invalid} />
                      {invalid && <p className="mt-1 text-[11.5px] text-error">This question is required.</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-[16px] bg-white p-4">
          <span className="text-xs text-text-muted">Preview mode — answers here are never saved.</span>
          <button
            type="button"
            onClick={() => setTriedSubmit(true)}
            className="rounded-[11px] bg-primary px-5 py-2.5 text-sm font-bold text-white"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}
