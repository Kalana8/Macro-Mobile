"use client";

import { useRef, useState } from "react";
import type { PhotoAnnotation, ReportPhoto } from "@macro/shared/types";
import { deletePhotoAction, reorderPhotosAction, uploadReportPhotoAction } from "./actions";

async function uploadFile(file: File, reportId: string, sectionId: string): Promise<ReportPhoto> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("reportId", reportId);
  formData.set("sectionId", sectionId);
  const result = await uploadReportPhotoAction(formData);
  if ("error" in result && result.error) throw new Error(result.error);
  if (!("photo" in result) || !result.photo) throw new Error("Upload failed.");
  return result.photo as ReportPhoto;
}

export function PhotoGallery({
  reportId,
  sectionId,
  photos,
  annotations,
  onPhotosChange,
  onAnnotate,
}: {
  reportId: string;
  sectionId: string;
  photos: ReportPhoto[];
  annotations: Record<string, PhotoAnnotation>;
  onPhotosChange: (photos: ReportPhoto[]) => void;
  onAnnotate: (photo: ReportPhoto) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const replaceInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const dragIndex = useRef<number | null>(null);

  async function handleFiles(files: FileList | File[] | null) {
    const list = files ? Array.from(files) : [];
    if (list.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded = await Promise.all(list.map((f) => uploadFile(f, reportId, sectionId)));
      onPhotosChange([...photos, ...uploaded]);
      // A single new photo (the common case: camera capture, or one file
      // picked) goes straight into the annotation tool — no extra tap needed
      // to mark it up right when it's taken.
      if (uploaded.length === 1) onAnnotate(uploaded[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload one or more photos — try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleReplace(oldPhoto: ReportPhoto, file: File) {
    setUploading(true);
    setError(null);
    try {
      const newPhoto = await uploadFile(file, reportId, sectionId);
      await deletePhotoAction(oldPhoto.id, reportId);
      onPhotosChange(photos.map((p) => (p.id === oldPhoto.id ? newPhoto : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't replace the photo — try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photo: ReportPhoto) {
    onPhotosChange(photos.filter((p) => p.id !== photo.id));
    await deletePhotoAction(photo.id, reportId);
  }

  function movePhoto(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    [next[index], next[target]] = [next[target], next[index]];
    onPhotosChange(next);
    reorderPhotosAction(next.map((p) => p.id), reportId);
  }

  function handleDrop(index: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === index) return;
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(index, 0, moved);
    onPhotosChange(next);
    reorderPhotosAction(next.map((p) => p.id), reportId);
  }

  return (
    <div>
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-text-muted">Photos</div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-[12px] border-2 border-dashed p-3 ${dragOver ? "border-primary bg-primary/5" : "border-border bg-bg"}`}
      >
        <div className="flex gap-2">
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-border bg-white px-3 py-3 text-[12.5px] font-semibold text-primary">
            📷 Take Photo
            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-border bg-white px-3 py-3 text-[12.5px] font-semibold text-primary">
            🖼️ Upload / Drag &amp; Drop
            <input
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {uploading && <p className="mt-2 text-[11px] text-text-muted">Uploading…</p>}
        {error && <p className="mt-2 text-[11px] text-error-text">{error}</p>}

        {photos.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {photos.map((photo, index) => {
              const annotated = annotations[photo.id]?.annotated_image_url;
              return (
                <div
                  key={photo.id}
                  draggable
                  onDragStart={() => (dragIndex.current = index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(index)}
                  className="group relative overflow-hidden rounded-[10px] border border-border bg-white"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={annotated || photo.original_url}
                    alt="Report photo"
                    className="aspect-square w-full object-cover"
                  />
                  {annotated && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-primary/90 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      Annotated
                    </span>
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 px-1.5 py-1">
                    <button
                      type="button"
                      onClick={() => onAnnotate(photo)}
                      className="rounded bg-white/90 px-1.5 py-1 text-[10px] font-bold text-text-dark"
                    >
                      ✏️ Annotate
                    </button>
                    <div className="flex items-center gap-0.5">
                      <button type="button" onClick={() => movePhoto(index, -1)} aria-label="Move earlier" className="flex h-6 w-6 items-center justify-center rounded bg-white/90 text-text-dark">‹</button>
                      <button type="button" onClick={() => movePhoto(index, 1)} aria-label="Move later" className="flex h-6 w-6 items-center justify-center rounded bg-white/90 text-text-dark">›</button>
                      <button
                        type="button"
                        onClick={() => replaceInputs.current[photo.id]?.click()}
                        aria-label="Replace photo"
                        className="flex h-6 w-6 items-center justify-center rounded bg-white/90 text-text-dark"
                      >
                        ↻
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(photo)}
                        aria-label="Delete photo"
                        className="flex h-6 w-6 items-center justify-center rounded bg-white/90 text-error"
                      >
                        ✕
                      </button>
                      <input
                        ref={(el) => { replaceInputs.current[photo.id] = el; }}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleReplace(photo, file);
                          e.target.value = "";
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
