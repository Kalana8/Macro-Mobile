"use client";

import type { InductionAnswerValue, InductionAttempt, InductionQuestion } from "@macro/shared/types";

function formatAnswer(value: InductionAnswerValue): string {
  if (value === null || value === undefined || value === "") return "No answer";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "No answer";
  if (typeof value === "object" && "fileName" in value) return value.fileName;
  return String(value);
}

/** Shown only for a failed attempt — a passed attempt goes straight to the certificate screen instead of stopping here. */
export function AssessmentResultScreen({
  assignmentTitle,
  questions,
  attempt,
  allAttempts,
  passMarkPercent,
  showCorrectAnswers,
  canRetake,
  retakeBlockedReason,
  onRetake,
}: {
  assignmentTitle: string;
  questions: InductionQuestion[];
  attempt: InductionAttempt;
  allAttempts: InductionAttempt[];
  passMarkPercent: number;
  showCorrectAnswers: boolean;
  canRetake: boolean;
  retakeBlockedReason: string | null;
  onRetake: () => void;
}) {
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const wrongResults = attempt.results.filter((r) => r.correct === false);

  return (
    <div className="mx-auto max-w-lg p-5 pb-10">
      <div className="mb-5 flex flex-col items-center gap-2 rounded-2xl bg-error/10 p-6 text-center text-error">
        <div className="text-4xl">✗</div>
        <h1 className="text-xl font-extrabold text-text-dark">Assessment Not Passed</h1>
        <p className="text-sm">
          {assignmentTitle} — attempt {attempt.attemptNumber}
        </p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-white p-4 text-center">
          <div className="text-2xl font-extrabold text-text-dark">
            {attempt.score} / {attempt.maxScore}
          </div>
          <div className="text-xs text-text-muted">Your score — {attempt.percentage}%</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4 text-center">
          <div className="text-2xl font-extrabold text-text-dark">{passMarkPercent}%</div>
          <div className="text-xs text-text-muted">Required to pass</div>
        </div>
      </div>

      {showCorrectAnswers && wrongResults.length > 0 && (
        <div className="mb-4 flex flex-col gap-3">
          <div className="text-sm font-bold text-text-dark">Review your answers</div>
          {wrongResults.map((r) => {
            const q = questionById.get(r.questionId);
            if (!q) return null;
            return (
              <div key={r.questionId} className="rounded-xl border border-error/30 bg-error/5 p-3.5">
                <div className="text-[12.5px] font-semibold text-text-dark">
                  <span className="text-error">✗</span> {q.title}
                </div>
                <div className="mt-1 text-xs text-text-muted">Your answer: {formatAnswer(attempt.answers[r.questionId] ?? null)}</div>
                {q.correctAnswers && q.correctAnswers.length > 0 && (
                  <div className="mt-1 text-xs font-semibold text-olive-text">Correct answer: {q.correctAnswers.join(", ")}</div>
                )}
                {q.explanation && <div className="mt-1 text-xs text-text-muted">{q.explanation}</div>}
              </div>
            );
          })}
        </div>
      )}

      <div className="mb-4 rounded-xl border border-border bg-white p-4">
        <div className="mb-2 text-sm font-bold text-text-dark">Attempt History</div>
        <div className="flex flex-col gap-1.5">
          {allAttempts.map((a) => (
            <div key={a.attemptNumber} className="flex items-center justify-between text-[12.5px]">
              <span className="text-text-dark">Attempt {a.attemptNumber}</span>
              <span className={a.passed ? "font-bold text-olive-text" : "text-error"}>
                {a.percentage}% — {a.passed ? "Passed" : "Failed"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {canRetake ? (
        <button type="button" onClick={onRetake} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white">
          Retake Assessment
        </button>
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-bg p-4 text-center text-sm text-text-muted">
          {retakeBlockedReason ?? "You can't retake this assessment right now. Contact your administrator."}
        </div>
      )}
    </div>
  );
}
