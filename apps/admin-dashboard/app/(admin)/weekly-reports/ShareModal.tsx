"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { FieldLabel, PrimaryButton, TextArea, TextInput } from "@/components/ui";
import { formatDate } from "@macro/shared/datetime";
import type { ReportPdf } from "@macro/shared/types";
import { sendEmailAction, sendWhatsAppAction } from "./actions";
import type { ReportWithDetail } from "./types";

type Tab = "whatsapp" | "email";

function defaultSubject(report: ReportWithDetail): string {
  const site = report.siteName ?? report.companyName;
  const week = `${formatDate(report.week_start, { month: "short", day: "numeric" })} – ${formatDate(report.week_ending, { month: "short", day: "numeric" })}`;
  return `Weekly Action Report – ${site} – ${week}`;
}

function defaultMessage(report: ReportWithDetail): string {
  const site = report.siteName ?? report.companyName;
  return `Hi,\n\nPlease find attached the Weekly Action Report (${report.report_number}) for ${site}, covering ${formatDate(report.week_start, { month: "long", day: "numeric" })} – ${formatDate(report.week_ending, { month: "long", day: "numeric" })}. This report summarizes the site observations, required improvements, and actions taken during the inspection.\n\nPlease reach out if you have any questions.\n\nRegards,\nMacro Property Services`;
}

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
  const [phone, setPhone] = useState("");
  const [waMessage, setWaMessage] = useState(`${report.report_number} — Weekly Action Report is ready. Please find it attached.`);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject(report));
  const [message, setMessage] = useState(defaultMessage(report));
  const [sending, setSending] = useState(false);
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

  async function handleSendWhatsApp() {
    setSending(true);
    setError(null);
    const result = await sendWhatsAppAction(report.id, latestPdf!.id, latestPdf!.file_url, phone.trim(), waMessage);
    setSending(false);
    if (result.error) setError(result.error);
    else {
      setSent(true);
      onSent();
    }
  }

  async function handleSendEmail() {
    setSending(true);
    setError(null);
    const result = await sendEmailAction(report.id, latestPdf!.id, latestPdf!.file_url, to.trim(), cc.trim(), subject, message);
    setSending(false);
    if (result.error) setError(result.error);
    else {
      setSent(true);
      onSent();
    }
  }

  return (
    <Modal title="Share Report" onClose={onClose}>
      <div className="mb-4 flex gap-2 rounded-[11px] bg-bg p-1">
        <button
          type="button"
          onClick={() => setTab("whatsapp")}
          className={`flex-1 rounded-[9px] py-2 text-[12.5px] font-bold ${tab === "whatsapp" ? "bg-[#25D366] text-white" : "text-text-dark"}`}
        >
          Business WhatsApp
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
          Sent successfully.
        </div>
      ) : tab === "whatsapp" ? (
        <div className="flex flex-col gap-3">
          <div>
            <FieldLabel>Recipient (WhatsApp number, with country code)</FieldLabel>
            <TextInput value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 61412345678" />
          </div>
          <div>
            <FieldLabel>Message (optional)</FieldLabel>
            <TextArea rows={3} value={waMessage} onChange={(e) => setWaMessage(e.target.value)} />
          </div>
          {error && <div className="text-[12.5px] text-error-text">{error}</div>}
          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
              Cancel
            </button>
            <PrimaryButton onClick={handleSendWhatsApp} disabled={sending || !phone.trim()}>
              {sending ? "Sending…" : "Send via WhatsApp"}
            </PrimaryButton>
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
            <PrimaryButton onClick={handleSendEmail} disabled={sending || !to.trim()}>
              {sending ? "Sending…" : "Send Email"}
            </PrimaryButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
