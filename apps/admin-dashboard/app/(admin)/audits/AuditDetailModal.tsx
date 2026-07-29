"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { Badge, CheckboxSquare, PrimaryButton, TextInput } from "@/components/ui";
import type { Audit, AuditMainItem, AuditRating } from "@macro/shared/types";
import { sendAuditResultsAction, updateAuditRatingsAction, type AuditFormState } from "./actions";

const STATUS_TONE = { submit: "info", verify: "warning", complete: "success" } as const;
const STATUS_LABEL = { submit: "Pending", verify: "Saved", complete: "Complete" } as const;
const RATINGS: { key: AuditRating; label: string }[] = [
  { key: "not_satisfactory", label: "Not Satisfactory" },
  { key: "satisfactory", label: "Satisfactory" },
  { key: "good", label: "Good" },
];

function SaveButton() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save Ratings & Marks"}</PrimaryButton>;
}

function SendButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="w-full rounded-xl bg-orange py-3 text-sm font-bold text-white disabled:opacity-40"
    >
      {pending ? "Sending…" : "Send Results"}
    </button>
  );
}

export function AuditDetailModal({
  audit,
  companyName,
  employeeName,
  companyEmployees,
  onClose,
}: {
  audit: Audit;
  companyName: string;
  employeeName: string;
  companyEmployees: { id: string; full_name: string }[];
  onClose: () => void;
}) {
  const [mainAudits, setMainAudits] = useState<AuditMainItem[]>(audit.main_audits);
  const [finalMarks, setFinalMarks] = useState<string>(audit.final_marks?.toString() ?? "");
  const [recipients, setRecipients] = useState<string[]>(audit.sent_to ?? []);

  const [ratingsState, ratingsAction] = useActionState<AuditFormState, FormData>(updateAuditRatingsAction, {});
  const [sendState, sendAction] = useActionState<AuditFormState, FormData>(sendAuditResultsAction, {});

  useEffect(() => {
    if (sendState.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendState.success]);

  function updateMain(i: number, patch: Partial<AuditMainItem>) {
    setMainAudits((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function updateSub(mi: number, si: number, result: AuditRating) {
    setMainAudits((prev) =>
      prev.map((m, idx) =>
        idx === mi
          ? { ...m, sub_audits: m.sub_audits.map((s, sIdx) => (sIdx === si ? { ...s, result } : s)) }
          : m
      )
    );
  }
  function toggleRecipient(id: string) {
    setRecipients((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const status = audit.status as keyof typeof STATUS_TONE;

  return (
    <Modal title={companyName} onClose={onClose}>
      <div className="mb-1 flex items-center justify-between">
        <div className="text-xs text-text-muted">{audit.date}</div>
        <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? audit.status}</Badge>
      </div>
      <div className="mb-4 text-sm text-text-muted">{employeeName}</div>

      <form action={ratingsAction} className="flex flex-col gap-5">
        <input type="hidden" name="auditId" value={audit.id} />
        <input type="hidden" name="mainAuditsJson" value={JSON.stringify(mainAudits)} />
        <input type="hidden" name="finalMarks" value={finalMarks} />

        {mainAudits.map((ma, mi) => (
          <div key={ma.id}>
            <div className="mb-1 flex items-center gap-2">
              <TextInput
                value={ma.title}
                onChange={(e) => updateMain(mi, { title: e.target.value })}
                className="flex-1 font-extrabold"
              />
            </div>
            <div className="mt-2 overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg">
                    <th className="px-3 py-2.5 text-left text-[11px] font-bold text-text-muted">Subsection</th>
                    {RATINGS.map((r) => (
                      <th key={r.key} className="px-1.5 py-2.5 text-center text-[11px] font-bold text-text-muted">{r.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ma.sub_audits.map((sub, si) => (
                    <tr key={sub.id} className="border-t border-border">
                      <td className="px-3 py-2.5">
                        <TextInput
                          value={sub.text}
                          onChange={(e) =>
                            updateMain(mi, {
                              sub_audits: ma.sub_audits.map((s, idx) =>
                                idx === si ? { ...s, text: e.target.value } : s
                              ),
                            })
                          }
                          className="py-1.5 text-xs"
                        />
                      </td>
                      {RATINGS.map((r) => (
                        <td key={r.key} className="px-1.5 py-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => updateSub(mi, si, sub.result === r.key ? "" : r.key)}
                            className={`mx-auto flex h-[30px] w-[30px] items-center justify-center rounded-[7px] border-2 ${
                              sub.result === r.key ? "border-primary bg-primary" : "border-border bg-white"
                            }`}
                          >
                            {sub.result === r.key && (
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12.5l4.5 4.5L19 7" />
                              </svg>
                            )}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() =>
                updateMain(mi, {
                  sub_audits: [...ma.sub_audits, { id: crypto.randomUUID(), text: "", result: "" }],
                })
              }
              className="mt-2 text-[12.5px] font-semibold text-primary"
            >
              + Add sub-audit
            </button>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="whitespace-nowrap text-xs font-semibold text-text-muted">Main Audit Marks</div>
              <input
                type="number"
                min={0}
                value={ma.marks ?? ""}
                onChange={(e) => updateMain(mi, { marks: e.target.value === "" ? null : Number(e.target.value) })}
                className="w-16 rounded-lg border border-border px-2 py-1.5 text-center text-sm font-bold text-text-dark outline-none"
              />
            </div>
            <TextInput
              value={ma.comment}
              onChange={(e) => updateMain(mi, { comment: e.target.value })}
              placeholder="Additional notes for this audit"
              className="mt-2.5"
            />
            {ma.images.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {ma.images.map((url) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={url} src={url} alt="Attachment" className="h-16 w-16 rounded-lg object-cover" />
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="flex items-center justify-between rounded-xl bg-bg px-4 py-3.5">
          <div className="text-sm font-bold text-text-dark">Final Marks</div>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              value={finalMarks}
              onChange={(e) => setFinalMarks(e.target.value)}
              className="w-16 rounded-lg border border-border px-2 py-2 text-center text-sm font-extrabold text-primary outline-none"
            />
            <div className="text-sm font-semibold text-text-muted">/ {audit.max_marks}</div>
          </div>
        </div>

        {ratingsState.error && (
          <div className="text-[12.5px] text-error-text">{ratingsState.error}</div>
        )}
        <SaveButton />
      </form>

      <form action={sendAction} className="mt-5">
        <input type="hidden" name="auditId" value={audit.id} />
        {recipients.map((id) => <input key={id} type="hidden" name="recipientIds" value={id} />)}
        <div className="mb-2 text-xs font-bold text-text-muted">SEND AUDIT RESULTS</div>
        <div className="mb-2.5 max-h-32 overflow-y-auto rounded-xl border border-border p-2">
          {companyEmployees.map((e) => (
            <button
              type="button"
              key={e.id}
              onClick={() => toggleRecipient(e.id)}
              className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-[7px] text-left text-[13.5px] text-text-dark"
            >
              <CheckboxSquare checked={recipients.includes(e.id)} />
              {e.full_name}
            </button>
          ))}
        </div>
        {audit.sent_to?.length > 0 && (
          <div className="mb-2.5 text-[11.5px] text-text-muted">
            Last sent to {audit.sent_to.length} employee{audit.sent_to.length > 1 ? "s" : ""}
          </div>
        )}
        {sendState.error && (
          <div className="mb-2.5 text-[12.5px] text-error-text">{sendState.error}</div>
        )}
        <SendButton disabled={recipients.length === 0} />
      </form>

      <button
        type="button"
        onClick={onClose}
        className="mt-3 w-full rounded-[12px] bg-bg py-3 text-sm font-bold text-text-dark"
      >
        Close
      </button>
    </Modal>
  );
}
