"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge, FieldLabel, Select, TextInput } from "@/components/ui";
import type { PhotoAnnotation, ReportPdf, ReportPhoto, ReportShare, WeeklyReportStatus } from "@macro/shared/types";
import {
  addSectionAction,
  deleteSectionAction,
  markReportCompletedAction,
  updateReportHeaderAction,
  updateSectionAction,
  type ReportHeaderPatch,
  type SectionPatch,
} from "../actions";
import { HistoryPanel } from "../HistoryPanel";
import { PreviewModal } from "../PreviewModal";
import { SectionCard } from "../SectionCard";
import { ShareModal } from "../ShareModal";
import { parseWireAnnotations, type AnnotationsByPhotoId, type ReportWithDetail, type SectionWithPhotos, type WireAnnotationsByPhotoId } from "../types";

const STATUS_TONE: Record<WeeklyReportStatus, "neutral" | "info" | "warning" | "success"> = {
  draft: "neutral",
  in_progress: "warning",
  completed: "info",
  pdf_generated: "info",
  sent: "success",
};
const STATUS_LABEL: Record<WeeklyReportStatus, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  completed: "Completed",
  pdf_generated: "PDF Generated",
  sent: "Sent",
};

export function ReportEditor({
  report: initialReport,
  sections: initialSections,
  annotations: initialAnnotations,
  companies,
  sites,
  employees,
  pdfs: initialPdfs,
  shares,
  employeeNameById,
  initialAction,
}: {
  report: ReportWithDetail;
  sections: SectionWithPhotos[];
  annotations: WireAnnotationsByPhotoId;
  companies: { id: string; name: string }[];
  sites: { id: string; name: string; company_id: string }[];
  employees: { id: string; full_name: string }[];
  pdfs: ReportPdf[];
  shares: ReportShare[];
  employeeNameById: Map<string, string>;
  initialAction?: string;
}) {
  const router = useRouter();
  const [report, setReport] = useState(initialReport);
  const [sections, setSections] = useState(initialSections);
  const [annotations, setAnnotations] = useState<AnnotationsByPhotoId>(() => parseWireAnnotations(initialAnnotations));
  const [pdfs, setPdfs] = useState(initialPdfs);
  const [expandedId, setExpandedId] = useState<string | null>(sections[0]?.id ?? null);
  const [showPreview, setShowPreview] = useState(initialAction === "pdf");
  const [showShare, setShowShare] = useState(initialAction === "share");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  function updateHeaderField(patch: Partial<ReportWithDetail>) {
    setReport((r) => ({ ...r, ...patch }));
  }

  function sectionUpdater(sectionId: string, patch: SectionPatch) {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)));
  }

  function photosUpdater(sectionId: string, photos: ReportPhoto[]) {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, photos } : s)));
  }

  function annotationSaved(annotation: PhotoAnnotation) {
    setAnnotations((prev) => ({ ...prev, [annotation.photo_id]: annotation }));
  }

  async function handleAddSection() {
    const result = await addSectionAction(report.id, sections.length);
    if ("section" in result && result.section) {
      const newSection: SectionWithPhotos = { ...result.section, photos: [] };
      setSections((prev) => [...prev, newSection]);
      setExpandedId(newSection.id);
      if (report.status === "draft") setReport((r) => ({ ...r, status: "in_progress" }));
    }
  }

  async function handleDeleteSection(sectionId: string) {
    if (!window.confirm("Delete this section and its photos? This can't be undone.")) return;
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    await deleteSectionAction(sectionId, report.id);
  }

  async function handleSaveDraft() {
    setSaving(true);
    setSaveMessage(null);
    const headerPatch: ReportHeaderPatch = {
      title: report.title,
      week_start: report.week_start,
      week_ending: report.week_ending,
      company_id: report.company_id,
      site_id: report.site_id,
      location: report.location,
      auditor_id: report.auditor_id,
      supervisor_id: report.supervisor_id,
      report_date: report.report_date,
    };
    await Promise.all([
      updateReportHeaderAction(report.id, headerPatch),
      ...sections.map((s) =>
        updateSectionAction(s.id, report.id, {
          title: s.title,
          notes: s.notes,
        })
      ),
    ]);
    setSaving(false);
    setSaveMessage("Saved");
    setTimeout(() => setSaveMessage(null), 2000);
  }

  async function handleMarkCompleted() {
    const result = await markReportCompletedAction(report.id);
    if (!("error" in result) || !result.error) setReport((r) => ({ ...r, status: "completed" }));
  }

  const siteOptions = sites.filter((s) => s.company_id === report.company_id);
  const latestPdf = pdfs[0] ?? null;

  return (
    <div className="pb-24">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <button type="button" onClick={() => router.push("/weekly-reports")} className="text-xs font-semibold text-primary">
            ← All Reports
          </button>
          <div className="mt-1 flex items-center gap-2">
            <div className="text-xl font-extrabold text-text-dark">{report.report_number}</div>
            <Badge tone={STATUS_TONE[report.status]}>{STATUS_LABEL[report.status]}</Badge>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-[16px] border border-border bg-white p-4">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-wide text-text-muted">Report Details</div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <FieldLabel>Report Title</FieldLabel>
            <TextInput value={report.title} onChange={(e) => updateHeaderField({ title: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Week Starting</FieldLabel>
            <TextInput type="date" value={report.week_start} onChange={(e) => updateHeaderField({ week_start: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Week Ending</FieldLabel>
            <TextInput type="date" value={report.week_ending} onChange={(e) => updateHeaderField({ week_ending: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Report Date</FieldLabel>
            <TextInput type="date" value={report.report_date} onChange={(e) => updateHeaderField({ report_date: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Company</FieldLabel>
            <Select
              value={report.company_id}
              onChange={(e) => updateHeaderField({ company_id: e.target.value, site_id: null, companyName: companies.find((c) => c.id === e.target.value)?.name })}
            >
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel>Site</FieldLabel>
            <Select
              value={report.site_id ?? ""}
              onChange={(e) => updateHeaderField({ site_id: e.target.value || null, siteName: sites.find((s) => s.id === e.target.value)?.name ?? null })}
            >
              <option value="">No specific site</option>
              {siteOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel>Location</FieldLabel>
            <TextInput value={report.location} onChange={(e) => updateHeaderField({ location: e.target.value })} placeholder="e.g. Building B, Loading Dock" />
          </div>
          <div>
            <FieldLabel>Auditor</FieldLabel>
            <Select
              value={report.auditor_id ?? ""}
              onChange={(e) => updateHeaderField({ auditor_id: e.target.value || null, auditorName: employees.find((emp) => emp.id === e.target.value)?.full_name ?? "—" })}
            >
              <option value="">Select auditor</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel>Supervisor</FieldLabel>
            <Select
              value={report.supervisor_id ?? ""}
              onChange={(e) => updateHeaderField({ supervisor_id: e.target.value || null, supervisorName: employees.find((emp) => emp.id === e.target.value)?.full_name ?? "—" })}
            >
              <option value="">Select supervisor</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {sections.map((section, i) => (
          <SectionCard
            key={section.id}
            reportId={report.id}
            section={section}
            index={i}
            annotations={annotations}
            expanded={expandedId === section.id}
            onToggleExpand={() => setExpandedId(expandedId === section.id ? null : section.id)}
            onFieldChange={sectionUpdater}
            onPhotosChange={photosUpdater}
            onAnnotationSaved={annotationSaved}
            onDelete={handleDeleteSection}
          />
        ))}

        <button
          type="button"
          onClick={handleAddSection}
          className="rounded-[16px] border-2 border-dashed border-primary/40 bg-primary/5 py-4 text-sm font-bold text-primary"
        >
          + Add Section
        </button>
      </div>

      <div className="mt-6">
        <HistoryPanel report={report} pdfs={pdfs} shares={shares} employeeNameById={employeeNameById} />
      </div>

      {/* Sticky action bar — always-visible primary actions per the field-speed UX requirement. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] md:left-60 md:px-8">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {saveMessage && <span className="mr-auto text-xs font-semibold text-olive-text">{saveMessage}</span>}
          <button type="button" onClick={handleAddSection} className="rounded-[11px] border border-border px-4 py-2.5 text-sm font-bold text-text-dark">
            + Add Section
          </button>
          {report.status === "in_progress" && (
            <button type="button" onClick={handleMarkCompleted} className="rounded-[11px] border border-border px-4 py-2.5 text-sm font-bold text-text-dark">
              Mark Completed
            </button>
          )}
          <button type="button" onClick={handleSaveDraft} disabled={saving} className="rounded-[11px] border border-border px-4 py-2.5 text-sm font-bold text-text-dark disabled:opacity-50">
            {saving ? "Saving…" : "Save Draft"}
          </button>
          <button type="button" onClick={() => setShowPreview(true)} className="rounded-[11px] bg-primary px-4 py-2.5 text-sm font-bold text-white">
            Preview Report
          </button>
          <button type="button" onClick={() => setShowPreview(true)} className="rounded-[11px] bg-orange px-4 py-2.5 text-sm font-bold text-white">
            Generate PDF
          </button>
          <button type="button" onClick={() => setShowShare(true)} className="rounded-[11px] bg-[#25D366] px-4 py-2.5 text-sm font-bold text-white">
            Share
          </button>
        </div>
      </div>

      {showPreview && (
        <PreviewModal
          report={report}
          sections={sections}
          annotations={annotations}
          onClose={() => setShowPreview(false)}
          onGenerated={(pdf) => {
            setPdfs((prev) => [pdf, ...prev]);
            setReport((r) => ({ ...r, status: "pdf_generated" }));
          }}
        />
      )}

      {showShare && (
        <ShareModal
          report={report}
          latestPdf={latestPdf}
          onClose={() => setShowShare(false)}
          onSent={() => setReport((r) => ({ ...r, status: "sent" }))}
          onNeedsPdf={() => {
            setShowShare(false);
            setShowPreview(true);
          }}
        />
      )}
    </div>
  );
}
