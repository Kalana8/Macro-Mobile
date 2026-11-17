"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@macro/shared/supabase/client";
import { Modal } from "@/components/Modal";
import { CheckboxSquare, FieldLabel, PrimaryButton, Select, TextArea, TextInput } from "@/components/ui";
import { createPhotoShareAction } from "./actions";

export interface Contact {
  id: string;
  full_name: string;
  is_admin: boolean;
  companyIds: string[];
}

const MAX_PHOTOS = 10;
const MAX_BYTES = 10 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/heic", "image/webp"];

export function SendPhotosModal({
  adminId,
  contacts,
  companies,
  onClose,
}: {
  adminId: string;
  contacts: Contact[];
  companies: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [search, setSearch] = useState("");
  const [recipientIds, setRecipientIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Local previews for the chosen files, released when they change or the modal closes.
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const people = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter(
      (c) => c.id !== adminId && (!companyId || c.is_admin || c.companyIds.includes(companyId)) && (!q || c.full_name.toLowerCase().includes(q))
    );
  }, [contacts, adminId, companyId, search]);

  function addFiles(list: FileList | null) {
    setError(null);
    const chosen = Array.from(list ?? []);
    const rejected = chosen.filter((f) => !TYPES.includes(f.type) || f.size > MAX_BYTES);
    const ok = chosen.filter((f) => !rejected.includes(f));
    if (rejected.length) setError(`${rejected.length} file(s) skipped: photos must be JPG, PNG, HEIC or WebP, up to 10 MB.`);
    setFiles((prev) => [...prev, ...ok].slice(0, MAX_PHOTOS));
  }

  const toggle = (id: string) => setRecipientIds((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));
  const allShown = people.length > 0 && people.every((p) => recipientIds.includes(p.id));

  async function send() {
    setError(null);
    if (files.length === 0) return setError("Add at least one photo.");
    if (recipientIds.length === 0) return setError("Choose who to send them to.");
    setSending(true);
    const supabase = createClient();
    const id = crypto.randomUUID();
    const paths = files.map((f, i) => `${adminId}/${id}/${i + 1}.${f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : f.type === "image/heic" ? "heic" : "jpg"}`);
    try {
      const uploads = await Promise.all(paths.map((p, i) => supabase.storage.from("shared-photos").upload(p, files[i], { contentType: files[i].type })));
      if (uploads.some((u) => u.error)) throw new Error("A photo couldn’t be uploaded. Try again.");
      const result = await createPhotoShareAction({ id, companyId: companyId || null, note, paths, recipientIds });
      if (result.error) throw new Error(result.error);
      router.refresh();
      onClose();
    } catch (e) {
      // Remove anything already uploaded, so a retry starts clean.
      await supabase.storage.from("shared-photos").remove(paths).catch(() => {});
      setError(e instanceof Error ? e.message : "Couldn’t send these photos.");
      setSending(false);
    }
  }

  return (
    <Modal title="Send photos" onClose={onClose}>
      <div className="flex flex-col gap-3.5">
        <div>
          <FieldLabel>
            Photos ({files.length}/{MAX_PHOTOS})
          </FieldLabel>
          <div className="flex flex-wrap gap-2">
            {previews.map((url, i) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-lg object-cover" />
                <button
                  type="button"
                  aria-label={`Remove photo ${i + 1}`}
                  onClick={() => setFiles((f) => f.filter((_, n) => n !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-error text-[11px] text-white"
                >
                  ✕
                </button>
              </div>
            ))}
            {files.length < MAX_PHOTOS && (
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-lg border border-dashed border-primary text-2xl text-primary">
                +
                <input
                  type="file"
                  accept={TYPES.join(",")}
                  multiple
                  hidden
                  aria-label="Add photos"
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </div>

        <div>
          <FieldLabel>Note</FieldLabel>
          <TextArea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="What should they know about these photos?" />
        </div>

        <div>
          <FieldLabel>Company</FieldLabel>
          <Select value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
            <option value="">All companies</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <FieldLabel>Send to ({recipientIds.length} selected)</FieldLabel>
            {people.length > 0 && (
              <button
                type="button"
                onClick={() => setRecipientIds((r) => (allShown ? r.filter((id) => !people.some((p) => p.id === id)) : [...new Set([...r, ...people.map((p) => p.id)])]))}
                className="text-xs font-semibold text-primary"
              >
                {allShown ? "Clear" : "Select all"}
              </button>
            )}
          </div>
          <TextInput value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people" aria-label="Search people" />
          <div className="mt-2 max-h-56 overflow-y-auto rounded-[10px] border border-border p-1">
            {people.length === 0 ? (
              <div className="px-2 py-3 text-xs text-text-muted">No one matches.</div>
            ) : (
              people.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="checkbox"
                  aria-checked={recipientIds.includes(p.id)}
                  onClick={() => toggle(p.id)}
                  className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-[7px] text-left text-[13.5px] text-text-dark hover:bg-bg"
                >
                  <CheckboxSquare checked={recipientIds.includes(p.id)} />
                  <span className="flex-1">{p.full_name}</span>
                  {p.is_admin && <span className="text-[11px] font-semibold text-text-muted">Admin</span>}
                </button>
              ))
            )}
          </div>
        </div>

        {error && <div className="text-[12.5px] text-error-text">{error}</div>}

        <div className="mt-1 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
            Cancel
          </button>
          <PrimaryButton type="button" onClick={send} disabled={sending}>
            {sending ? `Sending ${files.length} photo${files.length === 1 ? "" : "s"}…` : "Send"}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
