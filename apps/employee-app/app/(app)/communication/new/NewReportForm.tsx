"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@macro/shared/supabase/client";
import { ensureFirebaseSession, createConversation, sendMessage } from "@macro/shared/firebase/chat";
import { FieldLabel, PrimaryButton, TextArea, TextInput } from "@/components/ui";
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

export function NewReportForm({
  companies,
  sites,
}: {
  companies: { id: string; name: string }[];
  sites: Site[];
}) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [siteId, setSiteId] = useState("");
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSites = useMemo(() => sites.filter((s) => s.company_id === companyId), [sites, companyId]);

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

      const ready = await ensureFirebaseSession();
      if (ready) {
        await createConversation(result.id, { employeeIds: [user.id], companyId, siteId: siteId || null });
        const imageUrls = await Promise.all(files.map(uploadFile));
        await sendMessage(result.id, user.id, user.email ?? "You", message.trim(), imageUrls);
      }

      router.push(`/communication/${result.id}`);
    } finally {
      setSubmitting(false);
    }
  }

  if (companies.length === 0) {
    return (
      <div className="rounded-lg bg-bg px-3.5 py-3 text-xs text-text-muted">
        You&apos;re not assigned to a company yet — ask your admin to assign you before reporting an issue.
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
        <TextArea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Describe the issue…" />
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
        {submitting ? "Sending…" : "Send Report"}
      </PrimaryButton>
    </div>
  );
}
