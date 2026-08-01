"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@macro/shared/supabase/client";
import { ensureFirebaseSession, createConversation, sendMessage } from "@macro/shared/firebase/chat";
import { CheckboxSquare, FieldLabel, PrimaryButton, TextArea, TextInput } from "@/components/ui";
import { createCommunicationAction, uploadCommunicationImageAction } from "../actions";

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
  companyId: string;
}

export function NewReportForm({
  companies,
  sites,
  employees,
  currentEmployeeId,
  currentEmployeeName,
}: {
  companies: { id: string; name: string }[];
  sites: Site[];
  employees: EmployeeOption[];
  currentEmployeeId: string;
  currentEmployeeName: string;
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [siteId, setSiteId] = useState("");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSites = useMemo(() => sites.filter((s) => s.company_id === companyId), [sites, companyId]);
  // Everyone but yourself — you're always included as a recipient automatically.
  const availableRecipients = useMemo(
    () => employees.filter((e) => e.companyId === companyId && e.id !== currentEmployeeId),
    [employees, companyId, currentEmployeeId]
  );

  function toggleRecipient(id: string) {
    setRecipientIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit() {
    setError(null);
    if (!companyId) return setError("Choose which company this is about.");
    if (!title.trim()) return setError("Title is required.");
    if (!message.trim() && files.length === 0) return setError("Write a message or attach an image.");

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("companyId", companyId);
      formData.set("siteId", siteId);
      formData.set("title", title.trim());
      formData.set("priority", priority);
      recipientIds.forEach((id) => formData.append("recipientIds", id));

      const result = await createCommunicationAction({}, formData);
      if (result.error || !result.id) {
        setError(result.error ?? "Something went wrong.");
        return;
      }

      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Your session expired. Log in again.");
        return;
      }

      const allRecipientIds = [user.id, ...recipientIds];
      const ready = await ensureFirebaseSession();
      if (ready) {
        await createConversation(result.id, { employeeIds: allRecipientIds, companyId, siteId: siteId || null });
        const imageUrls = await Promise.all(files.map(uploadFile));
        await sendMessage(result.id, user.id, currentEmployeeName, message.trim(), imageUrls);
      }

      router.push(`/communication/${result.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (companies.length === 0) {
    return (
      <div className="rounded-lg bg-bg px-3.5 py-3 text-xs text-text-muted">
        You&apos;re not assigned to a company yet — ask your admin to assign you before sending a message.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {companies.length > 1 && (
        <div>
          <FieldLabel>Company</FieldLabel>
          <select
            value={companyId}
            onChange={(e) => {
              setCompanyId(e.target.value);
              setSiteId("");
              setRecipientIds([]);
            }}
            className="w-full rounded-lg border border-border bg-bg px-4 py-3 text-[15px] text-text-dark outline-none focus:border-primary"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {availableSites.length > 0 && (
        <div>
          <FieldLabel>Site (optional)</FieldLabel>
          <select
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            className="w-full rounded-lg border border-border bg-bg px-4 py-3 text-[15px] text-text-dark outline-none focus:border-primary"
          >
            <option value="">No specific site</option>
            {availableSites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      <div>
        <FieldLabel>Send To ({recipientIds.length + 1} selected)</FieldLabel>
        <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2">
          <div className="flex w-full items-center gap-2.5 rounded-lg px-2 py-[7px] text-left text-[13.5px] text-text-muted">
            <CheckboxSquare checked />
            You
          </div>
          {availableRecipients.length === 0 ? (
            <div className="px-2 py-1.5 text-[12.5px] text-text-muted">No other people at this company yet.</div>
          ) : (
            availableRecipients.map((e) => (
              <button
                type="button"
                key={e.id}
                onClick={() => toggleRecipient(e.id)}
                className="flex w-full items-center gap-2.5 rounded-lg px-2 py-[7px] text-left text-[13.5px] text-text-dark"
              >
                <CheckboxSquare checked={recipientIds.includes(e.id)} />
                {e.full_name}
              </button>
            ))
          )}
        </div>
      </div>

      <div>
        <FieldLabel>Title</FieldLabel>
        <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Broken equipment" />
      </div>

      <div>
        <FieldLabel>Priority</FieldLabel>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-4 py-3 text-[15px] text-text-dark outline-none focus:border-primary"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <div>
        <FieldLabel>Message</FieldLabel>
        <TextArea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Write your message…" />
      </div>

      <div>
        <FieldLabel>Images (optional)</FieldLabel>
        <label className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-border bg-bg px-4 py-3 text-sm font-semibold text-primary">
          {files.length > 0 ? `${files.length} image(s) attached` : "📎 Attach images"}
          <input type="file" accept="image/*" multiple hidden onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
        </label>
      </div>

      {error && <div className="rounded-lg bg-error/10 px-3 py-2 text-[12.5px] text-error">{error}</div>}

      <PrimaryButton type="button" onClick={handleSubmit} disabled={submitting}>
        {submitting ? "Sending…" : "Send"}
      </PrimaryButton>
    </div>
  );
}
