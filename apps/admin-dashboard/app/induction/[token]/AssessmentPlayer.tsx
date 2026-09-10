"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { QuestionInput } from "@/components/QuestionInput";
import type { InductionAnswerValue, InductionQuestion } from "@macro/shared/types";
import { submitAssessmentAction, type AssessmentSubmitState } from "./actions";

function isEmptyAnswer(value: InductionAnswerValue): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

function SubmitButton({ label, onClick }: { label: string; onClick: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" onClick={onClick} disabled={pending} className="flex-[2] rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-50">
      {pending ? "Submitting…" : label}
    </button>
  );
}

export function AssessmentPlayer({
  rawToken,
  assignmentTitle,
  questions,
  attemptNumber,
  onResult,
}: {
  rawToken: string;
  assignmentTitle: string;
  questions: InductionQuestion[];
  attemptNumber: number;
  onResult: (state: AssessmentSubmitState) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, InductionAnswerValue>>({});
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [state, formAction] = useActionState<AssessmentSubmitState, FormData>(submitAssessmentAction, {});
  const [startedAt] = useState(() => new Date().toISOString());
  const handledRef = useRef(state);

  useEffect(() => {
    if (state !== handledRef.current) {
      handledRef.current = state;
      if (state.result || state.error) onResult(state);
    }
  }, [state, onResult]);

  function setAnswer(id: string, value: InductionAnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  return (
    <div className="mx-auto max-w-lg p-5 pb-28">
      <div className="mb-4 text-center">
        <h1 className="text-lg font-extrabold text-text-dark">{assignmentTitle} — Assessment</h1>
        <p className="mt-1 text-xs text-text-muted">
          Attempt {attemptNumber} · {questions.length} question{questions.length === 1 ? "" : "s"}
        </p>
      </div>

      <form action={formAction} encType="multipart/form-data" className="flex flex-col gap-4">
        <input type="hidden" name="rawToken" value={rawToken} />
        <input type="hidden" name="startedAt" value={startedAt} />

        {questions.map((q, i) => {
          const invalid = triedSubmit && q.required && isEmptyAnswer(answers[q.id] ?? null);
          return (
            <div key={q.id} className="rounded-xl border border-border bg-white p-4">
              <label className="mb-1.5 block text-sm font-semibold text-text-dark">
                {i + 1}. {q.title}
                {q.required && <span className="ml-1 text-error">*</span>}
              </label>
              {q.description && <p className="mb-1.5 text-xs text-text-muted">{q.description}</p>}
              <QuestionInput question={q} value={answers[q.id] ?? null} onChange={(v) => setAnswer(q.id, v)} invalid={invalid} />
              {invalid && <p className="mt-1 text-[11.5px] text-error">This question is required.</p>}
            </div>
          );
        })}

        {state.error && <div className="rounded-lg bg-error/10 px-3.5 py-2.5 text-[12.5px] text-error">{state.error}</div>}

        <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-border bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
          <SubmitButton label="Submit Assessment" onClick={() => setTriedSubmit(true)} />
        </div>
      </form>
    </div>
  );
}
