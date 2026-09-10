"use client";

import { useCallback, useState } from "react";
import type { InductionAttempt, InductionFormSection, InductionQuestion, InductionTrainingSlide } from "@macro/shared/types";
import { InductionIntro } from "./InductionIntro";
import { TrainingPlayer } from "./TrainingPlayer";
import { AssessmentPlayer } from "./AssessmentPlayer";
import { AssessmentResultScreen } from "./AssessmentResultScreen";
import { CertificateScreen } from "./CertificateScreen";
import type { AssessmentSubmitState, InductionCertificateInfo } from "./actions";

type Phase = "intro" | "training" | "training_complete" | "assessment" | "result" | "certificate" | "passed_no_certificate" | "expired";

function shuffle<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function prepareQuestions(questions: InductionQuestion[], shuffleQuestions: boolean, shuffleOptions: boolean): InductionQuestion[] {
  let list = shuffleQuestions ? shuffle(questions) : questions;
  if (shuffleOptions) list = list.map((q) => (q.options ? { ...q, options: shuffle(q.options) } : q));
  return list;
}

export function InductionForm({
  rawToken,
  employeeName,
  siteName,
  companyName,
  assignmentTitle,
  assignmentDescription,
  sections,
  trainingSlides,
  passMarkPercent,
  maxAttempts,
  retakeDelayHours,
  shuffleQuestions,
  shuffleOptions,
  showCorrectAnswers,
  initialTrainingProgress,
  initialTrainingCompletedAt,
  initialAttempts,
}: {
  rawToken: string;
  employeeName: string;
  siteName: string;
  companyName: string;
  assignmentTitle: string;
  assignmentDescription: string;
  sections: InductionFormSection[];
  trainingSlides: InductionTrainingSlide[];
  passMarkPercent: number;
  maxAttempts: number | null;
  retakeDelayHours: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showCorrectAnswers: boolean;
  initialTrainingProgress: Record<string, { viewed: boolean; timeSpentSeconds: number }>;
  initialTrainingCompletedAt: string | null;
  initialAttempts: InductionAttempt[];
}) {
  const allQuestions = sections.flatMap((s) => s.questions);
  const lastAttempt = initialAttempts[initialAttempts.length - 1] ?? null;
  const alreadyStarted = Boolean(initialTrainingCompletedAt) || initialAttempts.length > 0 || Object.keys(initialTrainingProgress).length > 0;

  const [phase, setPhase] = useState<Phase>(() => {
    if (!alreadyStarted) return "intro";
    if (trainingSlides.length > 0 && !initialTrainingCompletedAt) return "training";
    if (lastAttempt && !lastAttempt.passed) return "result";
    return "assessment";
  });
  const [attempts, setAttempts] = useState<InductionAttempt[]>(initialAttempts);
  const [certificate, setCertificate] = useState<InductionCertificateInfo | null>(null);
  const [assessmentQuestions, setAssessmentQuestions] = useState<InductionQuestion[]>(() => prepareQuestions(allQuestions, shuffleQuestions, shuffleOptions));

  const startAssessment = useCallback(() => {
    setAssessmentQuestions(prepareQuestions(allQuestions, shuffleQuestions, shuffleOptions));
    setPhase("assessment");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shuffleQuestions, shuffleOptions]);

  const handleAssessmentResult = useCallback((state: AssessmentSubmitState) => {
    if (state.expired) {
      setPhase("expired");
      return;
    }
    if (!state.result) return; // a plain validation error — AssessmentPlayer already shows it inline.
    setAttempts((prev) => [...prev, state.result!.attempt]);
    if (state.result.passed) {
      if (state.certificate) {
        setCertificate(state.certificate);
        setPhase("certificate");
      } else {
        setPhase("passed_no_certificate");
      }
    } else {
      setPhase("result");
    }
  }, []);

  if (phase === "expired") {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-4xl">🔴</div>
        <h1 className="text-xl font-extrabold text-text-dark">Your induction link has expired</h1>
        <p className="text-sm text-text-muted">Your progress has been saved, but you need a new valid invitation link to continue.</p>
      </div>
    );
  }

  if (phase === "intro") {
    return <InductionIntro assignmentTitle={assignmentTitle} assignmentDescription={assignmentDescription} sections={sections} onStart={() => setPhase(trainingSlides.length > 0 ? "training" : "assessment")} />;
  }

  if (phase === "training") {
    const initialViewedIds = new Set(Object.entries(initialTrainingProgress).filter(([, v]) => v.viewed).map(([id]) => id));
    return (
      <TrainingPlayer
        rawToken={rawToken}
        assignmentTitle={assignmentTitle}
        slides={trainingSlides}
        initialViewedIds={initialViewedIds}
        onExpired={() => setPhase("expired")}
        onComplete={() => setPhase("training_complete")}
      />
    );
  }

  if (phase === "training_complete") {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-4xl">✅</div>
        <h1 className="text-xl font-extrabold text-text-dark">Training Completed</h1>
        <p className="text-sm text-text-muted">You&apos;ve reviewed all the required training content. When you&apos;re ready, start the assessment.</p>
        <button type="button" onClick={startAssessment} className="mt-2 rounded-xl bg-primary px-8 py-3 text-sm font-bold text-white">
          Start Assessment
        </button>
      </div>
    );
  }

  if (phase === "assessment") {
    return (
      <AssessmentPlayer
        key={attempts.length}
        rawToken={rawToken}
        assignmentTitle={assignmentTitle}
        questions={assessmentQuestions}
        attemptNumber={attempts.length + 1}
        onResult={handleAssessmentResult}
      />
    );
  }

  if (phase === "result") {
    const attempt = attempts[attempts.length - 1];
    const maxAttemptsReached = maxAttempts !== null && attempts.length >= maxAttempts;
    let retakeBlockedReason: string | null = null;
    let canRetake = !maxAttemptsReached;
    if (maxAttemptsReached) {
      retakeBlockedReason = "You have reached the maximum number of attempts for this assessment. Contact your administrator.";
    } else if (retakeDelayHours > 0) {
      const availableAt = new Date(new Date(attempt.submittedAt).getTime() + retakeDelayHours * 3600_000);
      if (new Date() < availableAt) {
        canRetake = false;
        retakeBlockedReason = `You can retake this assessment after ${availableAt.toLocaleString()}.`;
      }
    }
    return (
      <AssessmentResultScreen
        assignmentTitle={assignmentTitle}
        questions={allQuestions}
        attempt={attempt}
        allAttempts={attempts}
        passMarkPercent={passMarkPercent}
        showCorrectAnswers={showCorrectAnswers}
        canRetake={canRetake}
        retakeBlockedReason={retakeBlockedReason}
        onRetake={startAssessment}
      />
    );
  }

  if (phase === "passed_no_certificate") {
    const attempt = attempts[attempts.length - 1];
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-4xl">🎉</div>
        <h1 className="text-xl font-extrabold text-text-dark">Congratulations, {employeeName}!</h1>
        <p className="text-sm text-text-muted">
          You have successfully completed {assignmentTitle} at {siteName} — {companyName} with a score of {attempt.percentage}%.
        </p>
      </div>
    );
  }

  if (phase === "certificate" && certificate) {
    return <CertificateScreen employeeName={employeeName} certificate={certificate} justSubmitted expired={false} />;
  }

  return null;
}
