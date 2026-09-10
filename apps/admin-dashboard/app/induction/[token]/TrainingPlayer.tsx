"use client";

import { useEffect, useMemo, useState } from "react";
import type { InductionTrainingSlide } from "@macro/shared/types";
import { saveTrainingProgressAction, completeTrainingAction } from "./actions";
import { SlidePresentationCanvas } from "@/components/SlidePresentationCanvas";

export function TrainingPlayer({
  rawToken,
  assignmentTitle,
  slides,
  initialViewedIds,
  onComplete,
  onExpired,
}: {
  rawToken: string;
  assignmentTitle: string;
  slides: InductionTrainingSlide[];
  initialViewedIds: Set<string>;
  onComplete: () => void;
  onExpired: () => void;
}) {
  const firstUnviewed = useMemo(() => {
    const idx = slides.findIndex((s) => !initialViewedIds.has(s.id));
    return idx === -1 ? slides.length - 1 : idx;
  }, [slides, initialViewedIds]);

  const [index, setIndex] = useState(firstUnviewed);
  const [viewedIds, setViewedIds] = useState(initialViewedIds);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);

  const slide = slides[index];
  const alreadyViewed = viewedIds.has(slide.id);
  const remaining = Math.max(0, slide.minSeconds - elapsed);
  const canProceed = alreadyViewed || remaining <= 0;

  // A single ever-running ticker — resetting `elapsed` on slide change happens
  // in the navigation handlers below (real user actions), not here, since
  // calling setState synchronously inside an effect body risks cascading
  // renders.
  useEffect(() => {
    const interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  async function goNext() {
    if (!canProceed || saving) return;
    setSaving(true);
    const progressResult = await saveTrainingProgressAction(rawToken, slide.id, Math.max(elapsed, slide.minSeconds));
    if (progressResult.expired) {
      setSaving(false);
      onExpired();
      return;
    }
    setViewedIds((prev) => new Set(prev).add(slide.id));

    if (index === slides.length - 1) {
      const completeResult = await completeTrainingAction(rawToken);
      setSaving(false);
      if (completeResult.expired) {
        onExpired();
        return;
      }
      onComplete();
      return;
    }
    setSaving(false);
    setIndex((i) => i + 1);
    setElapsed(0);
  }

  function goBack() {
    if (index === 0) return;
    setIndex((i) => i - 1);
    setElapsed(0);
  }

  const progressPercent = Math.round(((index + 1) / slides.length) * 100);

  return (
    <div className="mx-auto max-w-3xl p-5 pb-28">
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-text-muted">
          <span>{assignmentTitle}</span>
          <span>
            Slide {index + 1} of {slides.length}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-bg">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <SlidePresentationCanvas slide={slide} />
      {slide.videoUrl && <video src={slide.videoUrl} controls className="mt-3 w-full rounded-lg" />}

      <div className={`mt-4 rounded-xl px-4 py-3 text-center text-xs font-semibold ${canProceed ? "bg-olive/15 text-olive-text" : "bg-bg text-text-muted"}`}>
        {canProceed ? "You may continue" : `Please review this slide for ${slide.minSeconds} seconds — time remaining: ${remaining} second${remaining === 1 ? "" : "s"}`}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-border bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <button
          type="button"
          onClick={goBack}
          disabled={index === 0}
          className="flex-1 rounded-xl border border-border py-3 text-sm font-bold text-text-dark disabled:opacity-40"
        >
          Back
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canProceed || saving}
          className="flex-[2] rounded-xl bg-primary py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : index === slides.length - 1 ? "Finish Training" : "Next →"}
        </button>
      </div>
    </div>
  );
}
