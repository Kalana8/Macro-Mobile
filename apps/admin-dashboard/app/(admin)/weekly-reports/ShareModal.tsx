"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { Badge, CheckboxSquare, FieldLabel, PrimaryButton, TextArea, TextInput } from "@/components/ui";
import { formatDate } from "@macro/shared/datetime";
import type { ReportPdf } from "@macro/shared/types";
import { logReportShareAction, shareReportWithUsersAction } from "./actions";
import type { ReportWithDetail } from "./types";

type Tab = "app" | "whatsapp" | "email";

export interface ShareTarget {
  id: string;
  full_name: string;
  job_role: string | null;
  companyIds: string[];
}

export interface ReportRecipient {
  employee_id: string;
  shared_at: string;
  seen_at: string | null;
  access: "view" | "edit";
  submitted_at: string | null;
  /** When they pressed Verified in the app (migration 0050). */
  verified_at: string | null;
  /** The note and photos (audit-images storage paths) they submitted (migration 0050). */
  response_note?: string;
  response_images?: string[];
}

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
  shareTargets,
  recipients,
  onClose,
  onSent,
  onNeedsPdf,
}: {
  report: ReportWithDetail;
  latestPdf: ReportPdf | null;
  shareTargets: ShareTarget[];
  /** Null until migration 0046 is applied. */
  recipients: ReportRecipient[] | null;
  onClose: () => void;
  onSent: () => void;
  onNeedsPdf: () => void;
}) {
  const [tab, setTab] = useState<Tab>("app");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(defaultSubject(report));
  const [message, setMessage] = useState(latestPdf ? defaultMessage(report, latestPdf.file_url) : "");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleOpenWhatsApp() {
    setError(null);
    // No prefilled number or message — just launches WhatsApp itself so you
    // pick the contact and write your own message there.
    window.open("https://wa.me/", "_blank", "noopener,noreferrer");
    const result = await logReportShareAction({
      reportId: report.id,
      pdfId: latestPdf?.id ?? null,
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
      pdfId: latestPdf?.id ?? null,
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

  const needsPdf = (
    <div>
      <div className="text-sm text-text-muted">Generate the PDF first so there&apos;s a finished report to share.</div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
          Cancel
        </button>
        <PrimaryButton onClick={onNeedsPdf}>Generate PDF</PrimaryButton>
      </div>
    </div>
  );

  return (
    <Modal title="Share Report" onClose={onClose}>
      <div className="mb-4 flex gap-2 rounded-[11px] bg-bg p-1">
        <button
          type="button"
          onClick={() => setTab("app")}
          className={`flex-1 rounded-[9px] py-2 text-[12.5px] font-bold ${tab === "app" ? "bg-primary-dark text-white" : "text-text-dark"}`}
        >
          App users
        </button>
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

      {tab === "app" ? (
        <AppUsersTab report={report} targets={shareTargets} recipients={recipients} onClose={onClose} onSent={onSent} />
      ) : !latestPdf ? (
        needsPdf
      ) : sent ? (
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

/**
 * Pick employees to send the report to in the employee app. It appears in their
 * Reports tab and they get a notification. Starts with the report's company.
 */
function AppUsersTab({
  report,
  targets,
  recipients,
  onClose,
  onSent,
}: {
  report: ReportWithDetail;
  targets: ShareTarget[];
  recipients: ReportRecipient[] | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [companyOnly, setCompanyOnly] = useState(true);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);
  const [shared, setShared] = useState(recipients ?? []);
  const byId = useMemo(() => new Map(shared.map((r) => [r.employee_id, r])), [shared]);

  const visible = targets.filter(
    (t) => (!companyOnly || t.companyIds.includes(report.company_id)) && t.full_name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const allVisibleChosen = visible.length > 0 && visible.every((t) => chosen.includes(t.id));
  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const toggleAll = () =>
    setChosen((c) => (allVisibleChosen ? c.filter((id) => !visible.some((t) => t.id === id)) : [...new Set([...c, ...visible.map((t) => t.id)])]));

  async function send() {
    setError(null);
    setBusy(true);
    const result = await shareReportWithUsersAction({ reportId: report.id, employeeIds: chosen, note });
    setBusy(false);
    if (result.error) return setError(result.error);
    const now = new Date().toISOString();
    setShared((s) => [...s.filter((r) => !chosen.includes(r.employee_id)), ...chosen.map((id) => ({ employee_id: id, shared_at: now, seen_at: null, access: "view" as const, submitted_at: null, verified_at: null }))]);
    setDone(chosen.length);
    setChosen([]);
    setNote("");
    onSent();
  }

  if (recipients === null) {
    return (
      <div className="rounded-lg bg-amber-100 px-3.5 py-3 text-sm text-text-dark">
        Sharing with app users isn&apos;t switched on yet. Run <code>0046_weekly_report_recipients.sql</code> in the Supabase SQL editor, then reload this page.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-text-muted">
        The report appears in their Reports tab in the app, view only, and they get a notification. When they press Verified, it shows here.
      </div>
      {done != null && (
        <div className="rounded-lg bg-olive/15 px-3.5 py-2.5 text-sm font-semibold text-olive-text">
          Sent to {done} {done === 1 ? "person" : "people"}.
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[180px] flex-1">
          <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" aria-label="Search people" />
        </div>
        <div className="flex gap-1 rounded-[10px] bg-bg p-1 text-[12px] font-semibold">
          <button type="button" aria-pressed={companyOnly} onClick={() => setCompanyOnly(true)} className={`rounded-[8px] px-2.5 py-1.5 ${companyOnly ? "bg-white text-text-dark shadow-sm" : "text-text-muted"}`}>
            {report.companyName}
          </button>
          <button type="button" aria-pressed={!companyOnly} onClick={() => setCompanyOnly(false)} className={`rounded-[8px] px-2.5 py-1.5 ${!companyOnly ? "bg-white text-text-dark shadow-sm" : "text-text-muted"}`}>
            Everyone
          </button>
        </div>
      </div>

      <div className="max-h-[300px] overflow-y-auto rounded-[12px] border border-border">
        {visible.length === 0 ? (
          <div className="px-3.5 py-4 text-sm text-text-muted">No one matches.</div>
        ) : (
          <>
            <button type="button" onClick={toggleAll} className="flex w-full items-center gap-3 border-b border-border bg-bg/60 px-3.5 py-2.5 text-left text-[12.5px] font-bold text-text-dark">
              <CheckboxSquare checked={allVisibleChosen} />
              Select all ({visible.length})
            </button>
            {visible.map((t) => {
              const prior = byId.get(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  role="checkbox"
                  aria-checked={chosen.includes(t.id)}
                  onClick={() => toggle(t.id)}
                  className="flex w-full items-center gap-3 border-b border-border px-3.5 py-2.5 text-left last:border-b-0 hover:bg-bg/50"
                >
                  <CheckboxSquare checked={chosen.includes(t.id)} />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-text-dark">{t.full_name}</span>
                    {t.job_role && <span className="block text-xs text-text-muted">{t.job_role}</span>}
                  </span>
                  {prior && (
                    <span className="flex flex-wrap justify-end gap-1">
                      <Badge tone={prior.submitted_at ? "info" : prior.verified_at ? "success" : prior.seen_at ? "info" : "neutral"}>
                        {prior.submitted_at ? "Submitted" : prior.verified_at ? "Verified" : prior.seen_at ? "Opened" : "Sent"}
                      </Badge>
                    </span>
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>

      <div>
        <FieldLabel>Note (optional)</FieldLabel>
        <TextArea rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything they should look at first?" />
      </div>
      {error && <div className="text-[12.5px] text-error-text">{error}</div>}
      <div className="mt-1 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
          Close
        </button>
        <PrimaryButton onClick={send} disabled={busy || chosen.length === 0}>
          {busy ? "Sending…" : chosen.length ? `Send to ${chosen.length} ${chosen.length === 1 ? "person" : "people"}` : "Send"}
        </PrimaryButton>
      </div>
    </div>
  );
}
