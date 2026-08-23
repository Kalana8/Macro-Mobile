"use client";

import { useState } from "react";
import { FieldLabel, TextInput } from "@/components/ui";
import type { PhotoAnnotation, ReportPhoto } from "@macro/shared/types";
import { AnnotationEditor } from "./AnnotationEditor";
import { PhotoGallery } from "./PhotoGallery";
import { RichTextEditor } from "./RichTextEditor";
import type { AnnotationsByPhotoId, SectionWithPhotos } from "./types";
import type { SectionPatch } from "./actions";

export function SectionCard({
  reportId,
  section,
  index,
  annotations,
  expanded,
  onToggleExpand,
  onFieldChange,
  onPhotosChange,
  onAnnotationSaved,
  onDelete,
}: {
  reportId: string;
  section: SectionWithPhotos;
  index: number;
  annotations: AnnotationsByPhotoId;
  expanded: boolean;
  onToggleExpand: () => void;
  onFieldChange: (sectionId: string, patch: SectionPatch) => void;
  onPhotosChange: (sectionId: string, photos: ReportPhoto[]) => void;
  onAnnotationSaved: (annotation: PhotoAnnotation) => void;
  onDelete: (sectionId: string) => void;
}) {
  const [annotatingPhoto, setAnnotatingPhoto] = useState<ReportPhoto | null>(null);

  return (
    <div className="rounded-[16px] border border-border bg-white">
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[12.5px] font-bold text-primary">
          {String(index + 1).padStart(2, "0")}
        </span>
        <button type="button" onClick={onToggleExpand} className="flex flex-1 items-center justify-between gap-2 text-left">
          <span className="truncate text-sm font-bold text-text-dark">{section.title || `Section ${index + 1}`}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onDelete(section.id)}
          aria-label="Delete section"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bg text-error"
        >
          ✕
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <div>
            <FieldLabel>Topic</FieldLabel>
            <TextInput
              value={section.title}
              onChange={(e) => onFieldChange(section.id, { title: e.target.value })}
              placeholder="e.g. Warehouse Cleaning Improvement"
            />
          </div>

          <PhotoGallery
            reportId={reportId}
            sectionId={section.id}
            photos={section.photos}
            annotations={annotations}
            onPhotosChange={(photos) => onPhotosChange(section.id, photos)}
            onAnnotate={setAnnotatingPhoto}
          />

          <div>
            <FieldLabel>Note</FieldLabel>
            <RichTextEditor value={section.notes} onChange={(html) => onFieldChange(section.id, { notes: html })} placeholder="What was observed, what needs to improve, action taken…" />
          </div>
        </div>
      )}

      {annotatingPhoto && (
        <AnnotationEditor
          photo={annotatingPhoto}
          reportId={reportId}
          annotation={annotations[annotatingPhoto.id]}
          onClose={() => setAnnotatingPhoto(null)}
          onSaved={onAnnotationSaved}
        />
      )}
    </div>
  );
}
