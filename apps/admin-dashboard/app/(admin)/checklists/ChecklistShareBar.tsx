"use client";

import { useState, type RefObject } from "react";
import type { Checklist } from "@macro/shared/types";

function checklistFileName(checklist: Checklist): string {
  const areaNames = checklist.areas.map((a) => a.main_area).join("-") || "checklist";
  const slug = `${checklist.assigned_date}-${areaNames}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `checklist-${slug || checklist.id}`;
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  link.click();
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}
function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}
function EmailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" /><path d="m3 6 9 6.5L21 6" />
    </svg>
  );
}
function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" />
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.03c-.24.68-1.4 1.3-1.93 1.38-.49.08-1.11.11-1.79-.11-.41-.13-.94-.31-1.62-.6-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.09 1-2.38.26-.28.57-.35.76-.35h.55c.18 0 .41-.07.64.49.24.57.81 1.98.88 2.12.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.16-.29.36-.42.49-.14.14-.28.29-.12.56.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.21 1.37.28.14.44.12.6-.07.16-.19.68-.79.87-1.06.19-.28.37-.23.62-.14.26.09 1.64.77 1.92.91.28.14.47.21.53.33.07.12.07.68-.17 1.36Z" />
    </svg>
  );
}

function BarButton({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-1.5 rounded-[10px] border border-border bg-white py-2.5 text-[12.5px] font-bold text-text-dark disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function LinkButton({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`flex items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[12.5px] font-bold ${className}`}>
      {children}
    </a>
  );
}

/** Image / PDF / WhatsApp / Email / Share controls for a submitted checklist's webpage. Shared by the admin modal and the public /shared/checklists/[id] page — Image and PDF both rasterize the ChecklistDocument node passed in via targetRef; the rest just point at shareUrl. */
export function ChecklistShareBar({
  targetRef,
  checklist,
  shareUrl,
}: {
  targetRef: RefObject<HTMLDivElement | null>;
  checklist: Checklist;
  shareUrl: string;
}) {
  const [busy, setBusy] = useState<"image" | "pdf" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSharePopover, setShowSharePopover] = useState(false);
  const [copied, setCopied] = useState(false);

  const title = checklist.areas.map((a) => a.main_area).join(", ") || "Checklist";

  async function captureNode() {
    const node = targetRef.current;
    if (!node) throw new Error("Nothing to capture yet.");

    // Without this, a capture triggered right after the modal opens can
    // fire before the checklist's photos have finished loading (or before
    // the Inter web font has swapped in), producing blank image tiles or a
    // fallback-font, misaligned-looking result.
    const images = Array.from(node.querySelectorAll("img"));
    await Promise.all([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      ...images.map((img) => (img.complete ? Promise.resolve() : img.decode().catch(() => undefined))),
    ]);

    const { toPng } = await import("html-to-image");
    return toPng(node, { pixelRatio: 2, cacheBust: true, backgroundColor: "#ffffff" });
  }

  async function handleDownloadImage() {
    setError(null);
    setBusy("image");
    try {
      const dataUrl = await captureNode();
      downloadDataUrl(dataUrl, `${checklistFileName(checklist)}.png`);
    } catch {
      setError("Couldn't generate the image — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDownloadPdf() {
    setError(null);
    setBusy("pdf");
    try {
      const dataUrl = await captureNode();
      const { jsPDF } = await import("jspdf");
      const img = new Image();
      img.src = dataUrl;
      await img.decode();

      // Scale the capture to fit a standard A4 width and slice it across as
      // many A4-height pages as needed, so it opens like a normal document
      // in a PDF viewer instead of one giant custom-sized page.
      const A4_WIDTH_MM = 210;
      const A4_HEIGHT_MM = 297;
      const imgHeightMm = (img.height * A4_WIDTH_MM) / img.width;

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      let heightLeftMm = imgHeightMm;
      let offsetMm = 0;
      doc.addImage(dataUrl, "PNG", 0, offsetMm, A4_WIDTH_MM, imgHeightMm);
      heightLeftMm -= A4_HEIGHT_MM;
      while (heightLeftMm > 0) {
        offsetMm -= A4_HEIGHT_MM;
        doc.addPage();
        doc.addImage(dataUrl, "PNG", 0, offsetMm, A4_WIDTH_MM, imgHeightMm);
        heightLeftMm -= A4_HEIGHT_MM;
      }
      doc.save(`${checklistFileName(checklist)}.pdf`);
    } catch {
      setError("Couldn't generate the PDF — try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    setError(null);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl });
      } catch {
        // User cancelled the native share sheet — not an error.
      }
      return;
    }
    setShowSharePopover(true);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("Couldn't copy the link — copy it manually instead.");
    }
  }

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title} — ${shareUrl}`)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`View the checklist here: ${shareUrl}`)}`;
  const shareTargets = [
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` },
    { label: "X", href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}` },
  ];

  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <BarButton onClick={handleDownloadImage} disabled={busy !== null}>
          <ImageIcon />
          {busy === "image" ? "Generating…" : "Image"}
        </BarButton>
        <BarButton onClick={handleDownloadPdf} disabled={busy !== null}>
          <DocIcon />
          {busy === "pdf" ? "Generating…" : "PDF"}
        </BarButton>
        <LinkButton href={whatsappUrl} className="border border-[#25D366] bg-[#25D366] text-white">
          <WhatsAppIcon />
          WhatsApp
        </LinkButton>
        <LinkButton href={emailUrl} className="border border-border bg-white text-text-dark">
          <EmailIcon />
          Email
        </LinkButton>
        <BarButton onClick={handleShare} disabled={busy !== null}>
          <ShareIcon />
          Share
        </BarButton>
      </div>

      {error && <div className="mt-2 text-[11.5px] text-error-text">{error}</div>}

      {showSharePopover && (
        <div className="mt-3 rounded-xl border border-border bg-bg p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <div className="text-[11px] font-bold text-text-muted">SHARE THIS CHECKLIST</div>
            <button type="button" onClick={() => setShowSharePopover(false)} className="text-text-muted" aria-label="Close">
              ✕
            </button>
          </div>
          <div className="mb-3 flex gap-2">
            <input
              readOnly
              value={shareUrl}
              onFocus={(e) => e.target.select()}
              className="flex-1 rounded-lg border border-border bg-white px-3 py-2 text-[12.5px] text-text-dark"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-[12.5px] font-bold text-white"
            >
              {copied ? "Copied ✓" : "Copy"}
            </button>
          </div>
          <div className="flex gap-2">
            {shareTargets.map((t) => (
              <a
                key={t.label}
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-lg bg-white py-2 text-center text-[12px] font-semibold text-text-dark"
              >
                {t.label}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
