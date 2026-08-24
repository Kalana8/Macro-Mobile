"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { FieldLabel, PrimaryButton, TextArea, TextInput } from "@/components/ui";
import { formatDate } from "@macro/shared/datetime";
import type { ReportPdf } from "@macro/shared/types";
import { logReportShareAction } from "./actions";
import type { ReportWithDetail } from "./types";

type Tab = "whatsapp" | "email";

function defaultSubject(report: ReportWithDetail): string {
  const site = report.siteName ?? report.companyName;
  const week = `${formatDate(report.week_start, { month: "short", day: "numeric" })} – ${formatDate(report.week_ending, { month: "short", day: "numeric" })}`;
  return `Weekly Action Report – ${site} – ${week}`;
}

function defaultMessage(report: ReportWithDetail, pdfUrl: string): string {
  const site = report.siteName ?? report.companyName;
  return `Hi,\n\nThe Weekly Action Report (${report.report_number}) for ${site}, covering ${formatDate(report.week_start, { month: "long", day: "numeric" })} – ${formatDate(report.week_ending, { month: "long", day: "numeric" })}, is ready. This report summarizes the site observations, required improvements, and actions taken during the inspection.\n\nDownload it here: ${pdfUrl}\n\nPlease reach out if you have any questions.\n\nRegards,\nMacro Property Services`;
}

/** Opens the user's own WhatsApp/email app with the report link pre-filled — same pattern as ChecklistShareBar — rather than a Business API integration. */
export function ShareModal({
  report,
  latestPdf,
  onClose,
  onSent,
  onNeedsPdf,
}: {
  report: ReportWithDetail;
  latestPdf: ReportPdf | null;
  onClose: () => void;
  onSent: () => void;
  onNeedsPdf: () => void;
}) {
  const [tab, setTab] = useState<Tab>("whatsapp");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject(report));
  const [message, setMessage] = useState(latestPdf ? defaultMessage(report, latestPdf.file_url) : "");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!latestPdf) {
    return (
      <Modal title="Share Report" onClose={onClose}>
        <div className="text-sm text-text-muted">
          Generate the PDF first so there&apos;s a finished report to share.
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
            Cancel
          </button>
          <PrimaryButton onClick={onNeedsPdf}>Generate PDF</PrimaryButton>
        </div>
      </Modal>
    );
  }

  async function handleOpenWhatsApp() {
    setError(null);
    // No prefilled number or message — just launches WhatsApp itself so you
    // pick the contact and write your own message there.
    window.open("https://wa.me/", "_blank", "noopener,noreferrer");
    const result = await logReportShareAction({
      reportId: report.id,
      pdfId: latestPdf!.id,
      channel: "whatsapp",
      recipient: "Shared via WhatsApp",
    });
    if (result.error) setError(result.error);
    else {
      setSent(true);
      onSent();
    }
  }

  function handleOpenEmail() {
    setError(null);
    if (!to.trim()) {
      setError("Enter a recipient email address.");
      return;
    }
    const params = new URLSearchParams({ subject, body: message });
    if (cc.trim()) params.set("cc", cc.trim());
    window.location.href = `mailto:${encodeURIComponent(to.trim())}?${params.toString()}`;
    logReportShareAction({
      reportId: report.id,
      pdfId: latestPdf!.id,
      channel: "email",
      recipient: to.trim(),
      cc: cc.trim(),
      subject,
      message,
    }).then((result) => {
      if (result.error) setError(result.error);
      else {
        setSent(true);
        onSent();
      }
    });
  }

  return (
    <Modal title="Share Report" onClose={onClose}>
      <div className="mb-4 flex gap-2 rounded-[11px] bg-bg p-1">
        <button
          type="button"
          onClick={() => setTab("whatsapp")}
          className={`flex-1 rounded-[9px] py-2 text-[12.5px] font-bold ${tab === "whatsapp" ? "bg-[#25D366] text-white" : "text-text-dark"}`}
        >
          WhatsApp
        </button>
        <button
          type="button"
          onClick={() => setTab("email")}
          className={`flex-1 rounded-[9px] py-2 text-[12.5px] font-bold ${tab === "email" ? "bg-primary text-white" : "text-text-dark"}`}
        >
          Email
        </button>
      </div>

      {sent ? (
        <div className="rounded-lg bg-olive/15 px-3.5 py-3 text-sm font-semibold text-olive-text">
          {tab === "whatsapp" ? "WhatsApp opened in a new tab." : "Your email app should now be open with the report ready to send."}
        </div>
      ) : tab === "whatsapp" ? (
        <div className="flex flex-col gap-3">
          <div className="text-sm text-text-muted">
            This opens WhatsApp so you can pick a contact and send the report yourself.
          </div>
          <a
            href={latestPdf.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[10px] border border-border px-3.5 py-2.5 text-center text-[12.5px] font-semibold text-text-dark"
          >
            Download PDF to attach
          </a>
          {error && <div className="text-[12.5px] text-error-text">{error}</div>}
          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
              Cancel
            </button>
            <PrimaryButton onClick={handleOpenWhatsApp}>Open WhatsApp</PrimaryButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div>
            <FieldLabel>To</FieldLabel>
            <TextInput type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="recipient@company.com" />
          </div>
          <div>
            <FieldLabel>CC (optional)</FieldLabel>
            <TextInput type="email" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="cc@company.com" />
          </div>
          <div>
            <FieldLabel>Subject</FieldLabel>
            <TextInput value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Message</FieldLabel>
            <TextArea rows={6} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          {error && <div className="text-[12.5px] text-error-text">{error}</div>}
          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
              Cancel
            </button>
            <PrimaryButton onClick={handleOpenEmail} disabled={!to.trim()}>
              Open Email
            </PrimaryButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
