"use client";

import { useMemo, useState, useTransition } from "react";
import { Modal } from "@/components/Modal";
import { Badge, EmptyState, FieldLabel, OutlineButton, PrimaryButton, Table, TextArea, TextInput } from "@/components/ui";
import { formatDate } from "@macro/shared/datetime";
import { CHECK_LABEL, CHECK_TONE, checkState, type CheckState, type CheckType, type EmployeeCheck } from "@/lib/checks";
import { addCheckTypeAction, checkDocumentUrlAction, reviewCheckAction, setCheckTypeActiveAction } from "./actions";

type Filter = "all" | "review" | "missing" | "done";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "review", label: "To review" },
  { key: "missing", label: "Not done" },
  { key: "done", label: "All done" },
];

const day = (iso: string) => formatDate(iso, { day: "2-digit", month: "short", year: "numeric" });

/**
 * Every active employee against every required check, with where each one
 * stands. Click a handed-in check to open the document and approve it or send
 * it back.
 */
export function ChecksTable({
  types,
  employees,
  checks,
  today,
}: {
  types: CheckType[];
  employees: { id: string; full_name: string }[];
  checks: EmployeeCheck[];
  today: string;
}) {
  const required = types.filter((t) => t.active);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState<{ check: EmployeeCheck; employee: string; type: string } | null>(null);
  const [managing, setManaging] = useState(false);

  const byKey = useMemo(() => new Map(checks.map((c) => [`${c.employee_id}:${c.check_type_id}`, c])), [checks]);
  const stateOf = (employeeId: string, typeId: string): CheckState => checkState(byKey.get(`${employeeId}:${typeId}`), today);

  const rows = employees.filter((e) => {
    if (search && !e.full_name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    const states = required.map((t) => stateOf(e.id, t.id));
    if (filter === "review") return states.includes("submitted");
    if (filter === "missing") return states.some((s) => s !== "approved");
    if (filter === "done") return states.every((s) => s === "approved");
    return true;
  });
  const toReview = checks.filter((c) => c.status === "submitted" && required.some((t) => t.id === c.check_type_id)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-[14px] border border-border bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-[9px] px-3 py-1.5 text-[12.5px] font-semibold ${filter === f.key ? "bg-primary text-white" : "border border-border bg-white text-text-dark"}`}
            >
              {f.label}
              {f.key === "review" && toReview > 0 ? ` (${toReview})` : ""}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <TextInput placeholder="Search employees…" value={search} onChange={(e) => setSearch(e.target.value)} className="sm:w-[220px]" />
          <OutlineButton type="button" onClick={() => setManaging(true)}>Check types</OutlineButton>
        </div>
      </div>

      {required.length === 0 ? (
        <EmptyState title="No checks required" hint="Add a check type, like a Police Check, to start asking for documents." />
      ) : rows.length === 0 ? (
        <EmptyState title="No employees match" />
      ) : (
        <Table head={["Employee", ...required.map((t) => t.name), "Progress"]}>
          {rows.map((e) => {
            const done = required.filter((t) => stateOf(e.id, t.id) === "approved").length;
            return (
              <tr key={e.id} className="border-b border-border last:border-0">
                <td className="px-5 py-3.5 font-semibold text-text-dark">{e.full_name}</td>
                {required.map((t) => {
                  const c = byKey.get(`${e.id}:${t.id}`);
                  const s = stateOf(e.id, t.id);
                  const badge = <Badge tone={CHECK_TONE[s]}>{CHECK_LABEL[s]}</Badge>;
                  return (
                    <td key={t.id} className="px-5 py-3.5">
                      {c ? (
                        <button
                          type="button"
                          onClick={() => setReviewing({ check: c, employee: e.full_name, type: t.name })}
                          className="flex flex-col items-start gap-0.5 text-left"
                          aria-label={`${t.name} for ${e.full_name}: ${CHECK_LABEL[s]}. Open`}
                        >
                          {badge}
                          <span className="text-[11px] text-text-muted">
                            {s === "approved" && c.expires_on ? `Until ${day(c.expires_on)}` : s === "expired" ? `Expired ${day(c.expires_on!)}` : `Sent ${day(c.submitted_at)}`}
                          </span>
                        </button>
                      ) : (
                        badge
                      )}
                    </td>
                  );
                })}
                <td className="px-5 py-3.5 text-sm font-bold text-text-dark">
                  {done}/{required.length}
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      {reviewing && <ReviewModal {...reviewing} today={today} onClose={() => setReviewing(null)} />}
      {managing && <TypesModal types={types} onClose={() => setManaging(false)} />}
    </div>
  );
}

function ReviewModal({ check, employee, type, today, onClose }: { check: EmployeeCheck; employee: string; type: string; today: string; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const s = checkState(check, today);

  async function openDocument() {
    setOpening(true);
    setError(null);
    const r = await checkDocumentUrlAction(check.id);
    setOpening(false);
    if (r.url) window.open(r.url, "_blank", "noopener");
    else setError(r.error ?? "Couldn't open the document.");
  }

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      const r = await reviewCheckAction(formData);
      if (r.error) setError(r.error);
      else onClose();
    });
  }

  return (
    <Modal title={`${type} — ${employee}`} onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge tone={CHECK_TONE[s]}>{CHECK_LABEL[s]}</Badge>
          <span className="text-text-muted">Handed in {day(check.submitted_at)}</span>
          {check.expires_on && <span className="text-text-muted">· Expires {day(check.expires_on)}</span>}
        </div>
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5">
          <span className="truncate text-sm font-semibold text-text-dark">{check.file_name || "Document"}</span>
          <OutlineButton type="button" onClick={openDocument} disabled={opening}>
            {opening ? "Opening…" : "Open document"}
          </OutlineButton>
        </div>
        {check.note && (
          <div className="text-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-text-muted">Employee note</div>
            <div className="text-text-dark">{check.note}</div>
          </div>
        )}
        {check.review_note && (
          <div className="text-sm">
            <div className="text-xs font-bold uppercase tracking-wide text-text-muted">Your note</div>
            <div className="text-text-dark">{check.review_note}</div>
          </div>
        )}

        <form action={submit} className="flex flex-col gap-3 border-t border-border pt-3.5">
          <input type="hidden" name="id" value={check.id} />
          <div>
            <FieldLabel>Expiry date (optional)</FieldLabel>
            <TextInput type="date" name="expiresOn" defaultValue={check.expires_on ?? ""} min={today} />
          </div>
          <div>
            <FieldLabel>Note to the employee</FieldLabel>
            <TextArea name="reviewNote" rows={2} placeholder="Needed when sending back, e.g. “The photo is blurry”." />
          </div>
          {error && <div className="text-[12.5px] text-error-text">{error}</div>}
          <div className="flex justify-end gap-2">
            <OutlineButton type="submit" name="decision" value="rejected" disabled={pending}>Send back</OutlineButton>
            <PrimaryButton type="submit" name="decision" value="approved" disabled={pending}>{pending ? "Saving…" : "Approve"}</PrimaryButton>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function TypesModal({ types, onClose }: { types: CheckType[]; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [formKey, setFormKey] = useState(0);

  function add(formData: FormData) {
    setError(null);
    start(async () => {
      const r = await addCheckTypeAction(formData);
      if (r.error) setError(r.error);
      else setFormKey((k) => k + 1);
    });
  }

  return (
    <Modal title="Check Types" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
          {types.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <div className={`text-sm font-semibold ${t.active ? "text-text-dark" : "text-text-muted line-through"}`}>{t.name}</div>
                {t.description && <div className="truncate text-xs text-text-muted">{t.description}</div>}
              </div>
              <form action={(fd) => start(() => setCheckTypeActiveAction(fd))}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="active" value={String(!t.active)} />
                <button type="submit" disabled={pending} className={`rounded-lg border border-border px-3 py-1.5 text-[12px] font-semibold ${t.active ? "text-error" : "text-primary"}`}>
                  {t.active ? "Turn off" : "Turn on"}
                </button>
              </form>
            </div>
          ))}
        </div>
        <form key={formKey} action={add} className="flex flex-col gap-2.5 border-t border-border pt-3.5">
          <div className="text-sm font-bold text-text-dark">Add a check</div>
          <TextInput name="name" placeholder="e.g. Working with Children Check" required />
          <TextInput name="description" placeholder="What to upload (optional)" />
          {error && <div className="text-[12.5px] text-error-text">{error}</div>}
          <div className="flex justify-end">
            <PrimaryButton type="submit" disabled={pending}>Add</PrimaryButton>
          </div>
        </form>
      </div>
    </Modal>
  );
}
