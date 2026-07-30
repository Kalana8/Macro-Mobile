"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { ImagePicker } from "@/components/ImagePicker";
import { todayInBusinessTimezone } from "@macro/shared/datetime";
import { FieldLabel, PrimaryButton, Select, TextInput } from "@/components/ui";
import { createAuditAction, uploadAuditImageAction, type AuditFormState } from "./actions";

interface DraftMainAudit {
  title: string;
  comment: string;
  subAudits: string[];
  images: string[];
}

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const result = await uploadAuditImageAction(formData);
  if (result.error || !result.url) throw new Error(result.error ?? "Upload failed.");
  return result.url;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save Audit"}</PrimaryButton>;
}

interface Site {
  id: string;
  name: string;
  company_id: string;
}

export function AddAuditModal({
  companies,
  sites,
  employeeCompanyMap,
  onClose,
}: {
  companies: { id: string; name: string }[];
  sites: Site[];
  employeeCompanyMap: { id: string; full_name: string; companyIds: string[] }[];
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<AuditFormState, FormData>(createAuditAction, {});
  // Two rows can share a company name (a known data quirk) — collapse to
  // one entry per name so the picker doesn't show apparent duplicates.
  const uniqueCompanies = useMemo(() => {
    const seen = new Set<string>();
    return companies.filter((c) => {
      const key = c.name.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [companies]);
  const [companyId, setCompanyId] = useState(uniqueCompanies[0]?.id ?? "");
  const [siteId, setSiteId] = useState("");
  const [mainAudits, setMainAudits] = useState<DraftMainAudit[]>([
    { title: "", comment: "", subAudits: [""], images: [] },
  ]);

  const employeeOptions = useMemo(
    () => employeeCompanyMap.filter((e) => e.companyIds.includes(companyId)),
    [employeeCompanyMap, companyId]
  );
  const siteOptions = useMemo(() => sites.filter((s) => s.company_id === companyId), [sites, companyId]);
  const selectedSiteName = siteOptions.find((s) => s.id === siteId)?.name ?? "";

  useEffect(() => {
    if (state.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  function updateMain(i: number, patch: Partial<DraftMainAudit>) {
    setMainAudits((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function updateSubAudit(mi: number, si: number, text: string) {
    setMainAudits((prev) =>
      prev.map((m, idx) =>
        idx === mi ? { ...m, subAudits: m.subAudits.map((s, sIdx) => (sIdx === si ? text : s)) } : m
      )
    );
  }

  return (
    <Modal title="Add Audit" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        <input type="hidden" name="mainAuditsJson" value={JSON.stringify(mainAudits)} />
        <input type="hidden" name="location" value={selectedSiteName} />
        <div>
          <FieldLabel>Company</FieldLabel>
          <Select
            name="companyId"
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setSiteId("");
            }}
          >
            {uniqueCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Site</FieldLabel>
          <Select name="siteId" value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">No specific site</option>
            {siteOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Employee</FieldLabel>
          <Select name="employeeId" defaultValue="">
            <option value="" disabled>Select employee</option>
            {employeeOptions.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Date</FieldLabel>
          <TextInput type="date" name="date" required defaultValue={todayInBusinessTimezone()} />
        </div>

        {mainAudits.map((ma, mi) => (
          <div key={mi} className="rounded-[14px] border border-border bg-bg p-3.5">
            <div className="mb-2.5 flex items-center gap-2">
              <TextInput
                value={ma.title}
                onChange={(e) => updateMain(mi, { title: e.target.value })}
                placeholder="Main audit, e.g. Fire Safety Audit"
                className="flex-1 font-semibold"
              />
              {mainAudits.length > 1 && (
                <button
                  type="button"
                  onClick={() => setMainAudits((prev) => prev.filter((_, idx) => idx !== mi))}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-text-muted"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="mb-1.5 text-[11px] font-semibold text-text-muted">SUB-AUDITS</div>
            <div className="flex flex-col gap-2">
              {ma.subAudits.map((s, si) => (
                <div key={si} className="flex items-center gap-2">
                  <TextInput
                    value={s}
                    onChange={(e) => updateSubAudit(mi, si, e.target.value)}
                    placeholder="e.g. Fire extinguishers accessible"
                    className="flex-1"
                  />
                  {ma.subAudits.length > 1 && (
                    <button
                      type="button"
                      onClick={() => updateMain(mi, { subAudits: ma.subAudits.filter((_, idx) => idx !== si) })}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-text-muted"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateMain(mi, { subAudits: [...ma.subAudits, ""] })}
                className="w-fit text-[12.5px] font-semibold text-primary"
              >
                + Add sub-audit
              </button>
            </div>
            <div className="mt-2.5">
              <textarea
                value={ma.comment}
                onChange={(e) => updateMain(mi, { comment: e.target.value })}
                placeholder="Notes for this main audit"
                rows={2}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="mt-2.5">
              <ImagePicker
                images={ma.images}
                onChange={(images) => updateMain(mi, { images })}
                uploadFile={uploadFile}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setMainAudits((prev) => [...prev, { title: "", comment: "", subAudits: [""], images: [] }])}
          className="w-fit text-sm font-bold text-primary"
        >
          + Add another main audit
        </button>

        {state.error && (
          <div className="text-[12.5px] text-error-text">{state.error}</div>
        )}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
            Cancel
          </button>
          <SubmitButton />
        </div>
      </form>
    </Modal>
  );
}
