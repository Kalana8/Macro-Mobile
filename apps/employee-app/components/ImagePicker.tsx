"use client";

import { useState } from "react";

/**
 * Multi-image attach with an explicit choice between camera and device
 * gallery (two separate file inputs — a single input's `capture` attribute
 * doesn't reliably offer both on every mobile browser). Uploads happen
 * immediately on selection via `uploadFile`; `images` holds the resulting
 * URLs, meant to be submitted as hidden fields alongside the rest of the form.
 */
export function ImagePicker({
  images,
  onChange,
  uploadFile,
}: {
  images: string[];
  onChange: (urls: string[]) => void;
  uploadFile: (file: File) => Promise<string>;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const urls = await Promise.all(Array.from(files).map(uploadFile));
      onChange([...images, ...urls]);
    } catch {
      setError("Couldn't upload one or more images — try again.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(url: string) {
    onChange(images.filter((u) => u !== url));
  }

  return (
    <div>
      <div className="flex gap-2">
        <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-bg px-3 py-2.5 text-[12.5px] font-semibold text-primary">
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
        <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-bg px-3 py-2.5 text-[12.5px] font-semibold text-primary">
          🖼️ Choose from Gallery
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

      {uploading && <p className="mt-1.5 text-[11px] text-text-muted">Uploading…</p>}
      {error && <p className="mt-1.5 text-[11px] text-error-text">{error}</p>}

      {images.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {images.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Attachment" className="h-20 w-20 rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => removeImage(url)}
                aria-label="Remove image"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-error text-[11px] text-white"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
