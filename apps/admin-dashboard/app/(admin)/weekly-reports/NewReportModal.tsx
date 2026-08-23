"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { FieldLabel, PrimaryButton, Select, TextInput } from "@/components/ui";
import { todayInBusinessTimezone } from "@macro/shared/datetime";
import { createReportAction, type ActionResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Creating…" : "Create Report"}</PrimaryButton>;
}

export function NewReportModal({
  companies,
  sites,
  employees,
  onClose,
}: {
  companies: { id: string; name: string }[];
  sites: { id: string; name: string; company_id: string }[];
  employees: { id: string; full_name: string }[];
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(createReportAction, {});
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const today = todayInBusinessTimezone();

  const weekStartDefault = useMemo(() => {
    const [y, m, d] = today.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() - date.getUTCDay() + 1); // Monday
    return date.toISOString().slice(0, 10);
  }, [today]);
  const weekEndDefault = useMemo(() => {
    const [y, m, d] = weekStartDefault.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() + 6);
    return date.toISOString().slice(0, 10);
  }, [weekStartDefault]);

  const siteOptions = sites.filter((s) => s.company_id === companyId);

  return (
    <Modal title="Create New Report" onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        <div>
          <FieldLabel>Report Title</FieldLabel>
          <TextInput name="title" placeholder="e.g. Warehouse Weekly Action Report" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Week Starting</FieldLabel>
            <TextInput type="date" name="weekStart" required defaultValue={weekStartDefault} />
          </div>
          <div>
            <FieldLabel>Week Ending</FieldLabel>
            <TextInput type="date" name="weekEnding" required defaultValue={weekEndDefault} />
          </div>
        </div>
        <div>
          <FieldLabel>Company</FieldLabel>
          <Select name="companyId" required value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="" disabled>Select company</option>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Site</FieldLabel>
          <Select name="siteId" defaultValue="">
            <option value="">No specific site</option>
            {siteOptions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </div>
        <div>
          <FieldLabel>Location</FieldLabel>
          <TextInput name="location" placeholder="e.g. Building B, Loading Dock" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Auditor</FieldLabel>
            <Select name="auditorId" defaultValue="">
              <option value="">Select auditor</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </Select>
          </div>
          <div>
            <FieldLabel>Supervisor</FieldLabel>
            <Select name="supervisorId" defaultValue="">
              <option value="">Select supervisor</option>
              {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </Select>
          </div>
        </div>
        <div>
          <FieldLabel>Report Date</FieldLabel>
          <TextInput type="date" name="reportDate" required defaultValue={today} />
        </div>

        {state.error && <div className="text-[12.5px] text-error-text">{state.error}</div>}

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
