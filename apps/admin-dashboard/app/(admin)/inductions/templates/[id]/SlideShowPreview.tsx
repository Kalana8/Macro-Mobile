"use client";

import { useEffect, useState } from "react";
import { SlidePresentationCanvas } from "@/components/SlidePresentationCanvas";
import type { InductionTrainingSlide } from "@macro/shared/types";

/**
 * Admin "Preview Presentation" — the exact same read-only slide renderer the
 * employee sees, with the same minimum-viewing countdown, but nothing here
 * is ever persisted: no training_progress row, no completion record.
 */
export function SlideShowPreview({ slides, onClose }: { slides: InductionTrainingSlide[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const slide = slides[index];
  const remaining = Math.max(0, slide.minSeconds - elapsed);
  const canProceed = remaining <= 0;

  useEffect(() => {
    const interval = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  function goNext() {
    if (!canProceed) return;
    if (index < slides.length - 1) {
      setIndex((i) => i + 1);
      setElapsed(0);
    }
  }
  function goBack() {
    if (index === 0) return;
    setIndex((i) => i - 1);
    setElapsed(0);
  }

  const progressPercent = Math.round(((index + 1) / slides.length) * 100);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[rgba(16,22,32,0.95)]">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="text-sm font-bold text-white">Preview Presentation</div>
        <button type="button" onClick={onClose} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
          Exit Preview
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5">
        <div className="mb-3">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-white/70">
            <span>Slide {index + 1} of {slides.length}</span>
            <span>{canProceed ? "You may continue" : `Time remaining: ${remaining}s`}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <SlidePresentationCanvas slide={slide} />
        {slide.videoUrl && <video src={slide.videoUrl} controls className="mt-3 w-full rounded-lg" />}
      </div>

      <div className="flex items-center justify-center gap-2 px-4 py-4">
        <button type="button" onClick={goBack} disabled={index === 0} className="rounded-xl border border-white/25 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-30">
          ← Previous
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!canProceed || index === slides.length - 1}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {index === slides.length - 1 ? "Last Slide" : "Next →"}
        </button>
      </div>
    </div>
  );
}
