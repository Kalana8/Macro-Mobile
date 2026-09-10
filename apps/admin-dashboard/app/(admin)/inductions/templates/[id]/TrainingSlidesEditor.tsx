"use client";

import { useRef, useState } from "react";
import type { InductionTrainingSlide } from "@macro/shared/types";
import { newId } from "./SectionsBuilder";
import { SlideCanvasEditor } from "./SlideCanvasEditor";
import { SlideThumbnail } from "./SlideThumbnail";
import { SlideShowPreview } from "./SlideShowPreview";

export function blankSlide(order: number): InductionTrainingSlide {
  return { id: newId("slide"), title: `Slide ${order}`, minSeconds: 20, canvasJson: null };
}

/**
 * PowerPoint-style training slide builder — left thumbnail rail (add,
 * duplicate, delete, drag-reorder, select), a Fabric.js canvas editor for
 * whichever slide is selected, and slide-level settings (title, minimum
 * viewing time, optional video). Fully controlled, saved together with the
 * rest of the assignment by the parent AssignmentBuilder.
 */
export function TrainingSlidesEditor({ slides, onChange }: { slides: InductionTrainingSlide[]; onChange: (slides: InductionTrainingSlide[]) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(slides[0]?.id ?? null);
  const [showPreview, setShowPreview] = useState(false);
  const dragIndex = useRef<number | null>(null);

  const selected = slides.find((s) => s.id === selectedId) ?? slides[0] ?? null;

  function updateSlide(id: string, patch: Partial<InductionTrainingSlide>) {
    onChange(slides.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function duplicateSlide(id: string) {
    const idx = slides.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const copy: InductionTrainingSlide = { ...slides[idx], id: newId("slide"), title: `${slides[idx].title} (Copy)` };
    const next = [...slides];
    next.splice(idx + 1, 0, copy);
    onChange(next);
    setSelectedId(copy.id);
  }

  function deleteSlide(id: string) {
    if (slides.length <= 1) return;
    const idx = slides.findIndex((s) => s.id === id);
    const next = slides.filter((s) => s.id !== id);
    onChange(next);
    if (selectedId === id) setSelectedId(next[Math.max(0, idx - 1)]?.id ?? null);
  }

  function addSlide() {
    const slide = blankSlide(slides.length + 1);
    onChange([...slides, slide]);
    setSelectedId(slide.id);
  }

  function handleDrop(index: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === index) return;
    const next = [...slides];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    onChange(next);
  }

  if (!selected) {
    return (
      <div className="rounded-[16px] border-2 border-dashed border-border bg-white p-10 text-center">
        <p className="mb-3 text-sm text-text-muted">No training slides yet.</p>
        <button type="button" onClick={addSlide} className="rounded-[10px] bg-primary px-4 py-2.5 text-sm font-bold text-white">
          + Add your first slide
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      {/* Left: slide thumbnails */}
      <div className="flex shrink-0 flex-row gap-2 overflow-x-auto pb-2 lg:w-[192px] lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:pb-0">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            draggable
            onDragStart={() => (dragIndex.current = i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(i)}
            onClick={() => setSelectedId(slide.id)}
            className={`group relative shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 ${selectedId === slide.id ? "border-primary" : "border-border"}`}
          >
            <SlideThumbnail slide={slide} />
            <span className="pointer-events-none absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[9px] font-bold text-white">
              {i + 1}
            </span>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-2 bg-black/60 px-1.5 py-1 opacity-0 group-hover:opacity-100">
              <button type="button" onClick={(e) => { e.stopPropagation(); duplicateSlide(slide.id); }} className="text-[11px] font-bold text-white" title="Duplicate slide">
                ⧉
              </button>
              {slides.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm("Delete this slide?")) deleteSlide(slide.id);
                  }}
                  className="text-[11px] font-bold text-white"
                  title="Delete slide"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={addSlide}
          className="flex h-[99px] w-[176px] shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-border text-xs font-bold text-text-muted hover:border-primary hover:text-primary lg:h-auto lg:min-h-[52px] lg:w-full"
        >
          + New Slide
        </button>
      </div>

      {/* Right: canvas editor for the selected slide */}
      <div className="min-w-0 flex-1">
        <div className="mb-3 flex flex-col gap-2.5 rounded-[12px] border border-border bg-white p-3 sm:flex-row sm:items-center">
          <input
            value={selected.title}
            onChange={(e) => updateSlide(selected.id, { title: e.target.value })}
            placeholder="Slide title / name"
            className="min-w-0 flex-1 rounded-[10px] border border-border bg-bg px-3 py-2 text-sm font-semibold text-text-dark outline-none focus:border-primary"
          />
          <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-text-dark">
            Min. time
            <input
              type="number"
              min={0}
              value={selected.minSeconds}
              onChange={(e) => updateSlide(selected.id, { minSeconds: Math.max(0, Number(e.target.value)) })}
              className="w-16 rounded-md border border-border bg-bg px-2 py-1.5 text-sm"
            />
            sec
          </label>
          <input
            value={selected.videoUrl ?? ""}
            onChange={(e) => updateSlide(selected.id, { videoUrl: e.target.value || undefined })}
            placeholder="Video URL (optional)"
            className="min-w-0 flex-1 rounded-[10px] border border-border bg-bg px-3 py-2 text-xs text-text-dark outline-none focus:border-primary sm:max-w-[220px]"
          />
          <button type="button" onClick={() => setShowPreview(true)} className="shrink-0 rounded-[10px] border border-border px-4 py-2 text-xs font-bold text-text-dark">
            Preview Presentation
          </button>
        </div>

        <SlideCanvasEditor key={selected.id} slide={selected} onChange={(patch) => updateSlide(selected.id, patch)} />
      </div>

      {showPreview && <SlideShowPreview slides={slides} onClose={() => setShowPreview(false)} />}
    </div>
  );
}
