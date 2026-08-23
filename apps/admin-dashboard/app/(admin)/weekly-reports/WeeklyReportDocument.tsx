"use client";

import { formatDate } from "@macro/shared/datetime";
import type { AnnotationsByPhotoId, ReportWithDetail, SectionWithPhotos } from "./types";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-bg px-3 py-2">
      <div className="text-[9.5px] font-bold uppercase tracking-wide text-text-muted">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold text-text-dark">{value || "—"}</div>
    </div>
  );
}

function photoUrl(photoId: string, originalUrl: string, annotations: AnnotationsByPhotoId): string {
  return annotations[photoId]?.annotated_image_url || originalUrl;
}

function PhotoGrid({ photos, annotations }: { photos: SectionWithPhotos["photos"]; annotations: AnnotationsByPhotoId }) {
  if (photos.length === 0) return null;
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {photos.map((p) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={p.id}
          src={photoUrl(p.id, p.original_url, annotations)}
          alt="Report photo"
          crossOrigin="anonymous"
          className="aspect-square w-full max-w-[150px] rounded-md border border-border object-cover"
        />
      ))}
    </div>
  );
}

function NoteBlock({ html }: { html: string }) {
  if (!html || html === "<br>") return null;
  return (
    <div className="mt-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Note</div>
      <div className="prose-notes mt-1 text-[12.5px] leading-relaxed text-text-dark" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/**
 * The "printed document" rendering of a Weekly Action Report — used both for
 * the live Preview and, block-by-block, as the capture source for PDF
 * generation (see PdfGenerator.ts). Each top-level block is registered via
 * `onRegisterBlock` so the PDF generator can rasterize the cover and each
 * section separately and pack them onto pages without cutting a photo in half.
 */
export function WeeklyReportDocument({
  report,
  sections,
  annotations,
  onRegisterBlock,
}: {
  report: ReportWithDetail;
  sections: SectionWithPhotos[];
  annotations: AnnotationsByPhotoId;
  onRegisterBlock?: (key: string, el: HTMLDivElement | null) => void;
}) {
  return (
    <div className="bg-white text-text-dark">
      <div ref={(el) => onRegisterBlock?.("cover", el)} className="w-[800px] bg-white p-8">
        <div className="flex items-center justify-between border-b-4 border-primary pb-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/uploads/macro-logo.webp" alt="Macro Property Services" className="h-12 w-auto" crossOrigin="anonymous" />
          <div className="text-right">
            <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-primary">Weekly Action Report</div>
            <div className="text-[11px] text-text-muted">{report.report_number}</div>
          </div>
        </div>

        <div className="mt-5 text-2xl font-extrabold">{report.title || "Weekly Action Report"}</div>
        <div className="mt-1 text-sm text-text-muted">
          {formatDate(report.week_start, { month: "long", day: "numeric" })} – {formatDate(report.week_ending, { month: "long", day: "numeric", year: "numeric" })}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Field label="Site / Company" value={report.siteName ? `${report.siteName} — ${report.companyName}` : report.companyName} />
          <Field label="Location" value={report.location} />
          <Field label="Report Date" value={formatDate(report.report_date, { month: "short", day: "numeric", year: "numeric" })} />
          <Field label="Auditor" value={report.auditorName} />
          <Field label="Supervisor" value={report.supervisorName} />
          <Field label="Sections" value={String(sections.length)} />
        </div>
      </div>

      <div className="flex flex-col gap-6 px-8 pb-8">
        {sections.map((section, i) => (
          <div key={section.id} ref={(el) => onRegisterBlock?.(section.id, el)} className="w-[736px] rounded-xl border border-border bg-white p-5">
            <div className="mb-3 flex items-baseline gap-2 border-b border-border pb-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="text-[15px] font-bold">{section.title || `Section ${i + 1}`}</div>
            </div>

            <PhotoGrid photos={section.photos} annotations={annotations} />
            <NoteBlock html={section.notes} />
          </div>
        ))}
      </div>
    </div>
  );
}
