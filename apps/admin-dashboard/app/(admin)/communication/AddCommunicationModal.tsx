"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureFirebaseSession, createConversation, sendMessage } from "@macro/shared/firebase/chat";
import { Modal } from "@/components/Modal";
import { CheckboxSquare, FieldLabel, PrimaryButton, Select, TextArea, TextInput } from "@/components/ui";
import { createCommunicationAction, uploadCommunicationImageAction } from "./actions";

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const result = await uploadCommunicationImageAction(formData);
  if (result.error || !result.url) throw new Error(result.error ?? "Upload failed.");
  return result.url;
}

interface Site {
  id: string;
  name: string;
  company_id: string;
}
interface EmployeeOption {
  id: string;
  full_name: string;
  companyIds: string[];
}

export function AddCommunicationModal({
  companies,
  sites,
  employees,
  adminId,
  adminName,
  onClose,
}: {
  companies: { id: string; name: string }[];
  sites: Site[];
  employees: EmployeeOption[];
  adminId: string;
  adminName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState("");
  const [siteId, setSiteId] = useState("");
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSites = useMemo(() => sites.filter((s) => s.company_id === companyId), [sites, companyId]);
  const availableEmployees = useMemo(
    () => employees.filter((e) => e.companyIds.includes(companyId)),
    [employees, companyId]
  );

  function toggleEmployee(id: string) {
    setEmployeeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit() {
    setError(null);
    if (!companyId || employeeIds.length === 0) return setError("Company and at least one employee are required.");
    if (!title.trim()) return setError("Title is required.");

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("companyId", companyId);
      formData.set("siteId", siteId);
      employeeIds.forEach((id) => formData.append("employeeIds", id));
      formData.set("title", title.trim());
      formData.set("priority", priority);

      const result = await createCommunicationAction({}, formData);
      if (result.error || !result.id) {
        setError(result.error ?? "Something went wrong.");
        return;
      }

      const ready = await ensureFirebaseSession();
      if (ready) {
        const allRecipientIds = Array.from(new Set([adminId, ...employeeIds]));
        await createConversation(result.id, { employeeIds: allRecipientIds, companyId, siteId: siteId || null });
        if (message.trim() || files.length > 0) {
          const imageUrls = await Promise.all(files.map(uploadFile));
          await sendMessage(result.id, adminId, adminName, message.trim(), imageUrls);
        }
      }

      onClose();
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New Communication" onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <div>
          <FieldLabel>Company</FieldLabel>
          <Select
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setSiteId("");
              setEmployeeIds([]);
            }}
          >
            <option value="">Select company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>

        {companyId && (
          <div>
            <FieldLabel>Site (optional)</FieldLabel>
            <Select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
              <option value="">No specific site</option>
              {availableSites.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
        )}

        {companyId && (
          <div>
            <FieldLabel>Employees ({employeeIds.length} selected)</FieldLabel>
            <div className="max-h-40 overflow-y-auto rounded-[11px] border border-border p-2">
              {availableEmployees.length === 0 ? (
                <div className="px-2 py-1.5 text-[12.5px] text-text-muted">No employees assigned to this company yet.</div>
              ) : (
                availableEmployees.map((e) => (
                  <button
                    type="button"
                    key={e.id}
                    onClick={() => toggleEmployee(e.id)}
                    className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-[7px] text-left text-[13.5px] text-text-dark"
                  >
                    <CheckboxSquare checked={employeeIds.includes(e.id)} />
                    {e.full_name}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div>
          <FieldLabel>Title</FieldLabel>
          <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Missed checklist follow-up" />
        </div>

        <div>
          <FieldLabel>Priority</FieldLabel>
          <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </Select>
        </div>

        <div>
          <FieldLabel>Message</FieldLabel>
          <TextArea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Write your message…" />
        </div>

        <div>
          <FieldLabel>Images (optional)</FieldLabel>
          <label className="flex cursor-pointer items-center justify-center rounded-[11px] border border-dashed border-border bg-bg px-3.5 py-3 text-[12.5px] font-semibold text-primary">
            {files.length > 0 ? `${files.length} image(s) attached` : "📎 Attach images"}
            <input type="file" accept="image/*" multiple hidden onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </label>
        </div>

        {error && <div className="text-[12.5px] text-error-text">{error}</div>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
            Cancel
          </button>
          <PrimaryButton type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Sending…" : "Send"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
