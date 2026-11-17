"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { FieldLabel, PrimaryButton, Select, TextInput } from "@/components/ui";
import { createSiteInductionAction, type SiteInductionResult } from "./actions";

const EXPIRY_OPTIONS = [
  { value: "24h", label: "24 hours" },
  { value: "48h", label: "48 hours" },
  { value: "3d", label: "3 days" },
  { value: "7d", label: "7 days (default)" },
  { value: "14d", label: "14 days" },
  { value: "30d", label: "30 days" },
  { value: "custom", label: "Custom date/time" },
];

export interface CompanyOption {
  id: string;
  name: string;
}
export interface SiteOption {
  id: string;
  name: string;
  company_id: string;
}
export interface MemberOption {
  employee_id: string;
  company_id: string;
  full_name: string;
  /** The sites they work at; null before migration 0062 (then: every site of the company). */
  siteIds: string[] | null;
}

function SubmitButton({ count }: { count: number }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Sending…" : count > 0 ? `Send to ${count} ${count === 1 ? "employee" : "employees"}` : "Save"}
    </PrimaryButton>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // the link is still visible to select by hand
        }
      }}
      className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-[12px] font-bold text-primary"
    >
      {copied ? "Copied ✓" : "Copy link"}
    </button>
  );
}

/**
 * Add an induction to a site. Like a check, it goes to everyone who works at
 * the site (they see it in the app), and anyone added to the site later gets
 * it automatically.
 */
export function CreateInductionModal({
  companies,
  sites,
  members,
  templates,
  defaultTemplateId,
  onClose,
}: {
  companies: CompanyOption[];
  sites: SiteOption[];
  members: MemberOption[];
  templates: { id: string; name: string }[];
  defaultTemplateId?: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<SiteInductionResult, FormData>(createSiteInductionAction, {});
  const [companyId, setCompanyId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [expiryOption, setExpiryOption] = useState("7d");

  const companySites = useMemo(() => sites.filter((s) => s.company_id === companyId), [sites, companyId]);
  const people = useMemo(
    () =>
      members
        .filter((m) => m.company_id === companyId && (!siteId || m.siteIds === null || m.siteIds.includes(siteId)))
        .sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [members, companyId, siteId],
  );
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  if (state.success || (state.links && state.links.length > 0)) {
    const links = state.links ?? [];
    return (
      <Modal title="Induction Sent" onClose={onClose}>
        <div className="flex flex-col gap-3.5">
          <div className="rounded-lg bg-olive/15 px-3.5 py-3 text-sm font-semibold text-olive-text">
            {links.length > 0
              ? `Sent to ${links.length} ${links.length === 1 ? "employee" : "employees"}. They'll see it in the app under Profile and on Home.`
              : "No new invitations were needed."}
            {state.automatic ? " Anyone added to this site later gets it automatically." : ""}
          </div>
          {state.error && <div className="text-[12.5px] text-error-text">{state.error}</div>}
          {(state.skipped ?? []).length > 0 && (
            <div className="text-[12.5px] text-text-muted">Already had it: {state.skipped!.join(", ")}.</div>
          )}
          {links.length > 0 && (
            <div className="flex max-h-[300px] flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {links.map((l) => (
                <div key={l.rawToken} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span className="font-semibold text-text-dark">{l.name}</span>
                  <CopyLink link={`${origin}/induction/${l.rawToken}`} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex justify-end">
            <PrimaryButton onClick={onClose}>Done</PrimaryButton>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Add Site Induction" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        <div>
          <FieldLabel>Company</FieldLabel>
          <Select
            name="companyId"
            required
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setSiteId("");
            }}
          >
            <option value="" disabled>Select company</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Site</FieldLabel>
          <Select name="siteId" required value={siteId} disabled={!companyId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="" disabled>{companyId ? (companySites.length ? "Select site" : "This company has no sites") : "Select a company first"}</option>
            {companySites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Induction Template</FieldLabel>
          <Select name="templateId" required defaultValue={defaultTemplateId ?? templates[0]?.id ?? ""}>
            {templates.length === 0 && <option value="" disabled>No templates yet — create one first</option>}
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Link Expiration</FieldLabel>
          <Select name="expiryOption" value={expiryOption} onChange={(e) => setExpiryOption(e.target.value)}>
            {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </div>
        {expiryOption === "custom" && (
          <div>
            <FieldLabel>Custom Expiration Date/Time</FieldLabel>
            <TextInput type="datetime-local" name="customExpiresAt" required />
          </div>
        )}

        {siteId && (
          <div>
            <FieldLabel>Goes to everyone at this site ({people.length})</FieldLabel>
            {people.length === 0 ? (
              <div className="rounded-lg border border-border px-3 py-2.5 text-[12.5px] text-text-muted">No employees at this site yet. They&apos;ll get it when they&apos;re added.</div>
            ) : (
              <div className="flex max-h-[220px] flex-col overflow-y-auto rounded-lg border border-border">
                {people.map((p) => (
                  <div key={p.employee_id} className="border-b border-border px-3 py-2 text-sm last:border-b-0">{p.full_name}</div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="rounded-lg bg-primary/5 px-3 py-2.5 text-[13px]">
          <span className="font-semibold text-text-dark">New employees get it automatically</span>
          <span className="block text-text-muted">Like checks: anyone added to this site later gets this induction too.</span>
        </div>

        {state.error && <div className="text-[12.5px] text-error-text">{state.error}</div>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
            Cancel
          </button>
          <SubmitButton count={siteId ? people.length : 0} />
        </div>
      </form>
    </Modal>
  );
}
