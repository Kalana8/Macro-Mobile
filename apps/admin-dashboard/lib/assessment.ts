import { GRADABLE_QUESTION_TYPES } from "@macro/shared/types";
import type { InductionAnswerValue, InductionAttempt, InductionAttemptAnswerResult, InductionQuestion } from "@macro/shared/types";

function answersMatch(given: InductionAnswerValue, correct: string[]): boolean {
  if (Array.isArray(given)) {
    // Checkboxes — every correct option selected, and nothing extra.
    const a = [...given].sort();
    const b = [...correct].sort();
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  if (typeof given === "string") return correct.includes(given);
  return false;
}

/**
 * Grades one assessment attempt against the current question set. Only
 * GRADABLE_QUESTION_TYPES contribute to the score — free-text and upload
 * questions can still be required, but have no single right answer, so
 * they're recorded with `correct: null` and never affect pass/fail.
 */
export function scoreAttempt(
  questions: InductionQuestion[],
  answers: Record<string, InductionAnswerValue>,
  passMarkPercent: number
): Pick<InductionAttempt, "results" | "score" | "maxScore" | "percentage" | "passed"> {
  const results: InductionAttemptAnswerResult[] = [];
  let score = 0;
  let maxScore = 0;

  for (const q of questions) {
    if (!GRADABLE_QUESTION_TYPES.includes(q.type) || !q.correctAnswers || q.correctAnswers.length === 0) {
      results.push({ questionId: q.id, correct: null, marksAwarded: 0, marksPossible: 0 });
      continue;
    }
    const marksPossible = q.marks ?? 1;
    const correct = answersMatch(answers[q.id] ?? null, q.correctAnswers);
    const marksAwarded = correct ? marksPossible : 0;
    results.push({ questionId: q.id, correct, marksAwarded, marksPossible });
    score += marksAwarded;
    maxScore += marksPossible;
  }

  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 100;
  return { results, score, maxScore, percentage, passed: percentage >= passMarkPercent };
}
