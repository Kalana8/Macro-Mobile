"use client";

import { useRef, useState } from "react";
import type { ReportPdf } from "@macro/shared/types";
import { generatePdfAction } from "./actions";
import { generateReportPdf } from "./PdfGenerator";
import { WeeklyReportDocument } from "./WeeklyReportDocument";
import type { AnnotationsByPhotoId, ReportWithDetail, SectionWithPhotos } from "./types";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Full "exactly as it will appear" preview (§8) — Generate PDF captures these same fixed-width blocks (see PdfGenerator.ts), so preview and output always match. */
export function PreviewModal({
  report,
  sections,
  annotations,
  onClose,
  onGenerated,
}: {
  report: ReportWithDetail;
  sections: SectionWithPhotos[];
  annotations: AnnotationsByPhotoId;
  onClose: () => void;
  onGenerated: (pdf: ReportPdf) => void;
}) {
  const blockRefs = useRef(new Map<string, HTMLDivElement>());
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGeneratePdf() {
    setGenerating(true);
    setError(null);
    try {
      const blocks = ["cover", ...sections.map((s) => s.id)]
        .map((key) => ({ key, el: blockRefs.current.get(key) }))
        .filter((b): b is { key: string; el: HTMLDivElement } => Boolean(b.el));

      const pdfBlob = await generateReportPdf(blocks, report.report_number);
      const formData = new FormData();
      formData.set("reportId", report.id);
      formData.set("file", pdfBlob, `${report.report_number}.pdf`);
      const result = await generatePdfAction(formData);
      if ("error" in result && result.error) throw new Error(result.error);
      if ("pdf" in result && result.pdf) {
        downloadBlob(pdfBlob, `${report.report_number}.pdf`);
        onGenerated(result.pdf as ReportPdf);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate the PDF — try again.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-[rgba(22,32,46,0.6)]">
      <div className="flex items-center justify-between bg-white px-4 py-3 shadow-sm">
        <div className="text-sm font-bold text-text-dark">Report Preview</div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-error-text">{error}</span>}
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-3.5 py-2 text-xs font-semibold text-text-dark">
            ← Back to Edit
          </button>
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={generating}
            className="rounded-lg bg-orange px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate PDF"}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto bg-bg py-6">
        <div className="mx-auto w-fit rounded-lg shadow-xl">
          <WeeklyReportDocument
            report={report}
            sections={sections}
            annotations={annotations}
            onRegisterBlock={(key, el) => {
              if (el) blockRefs.current.set(key, el);
              else blockRefs.current.delete(key);
            }}
          />
        </div>
      </div>
    </div>
  );
}
