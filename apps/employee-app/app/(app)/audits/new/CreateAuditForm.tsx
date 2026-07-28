"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { FieldLabel, PrimaryButton, TextArea, TextInput } from "@/components/ui";
import { SuccessOverlay } from "@/components/SuccessOverlay";
import { ImagePicker } from "@/components/ImagePicker";
import { createAuditAction, uploadAuditImageAction, type CreateAuditState } from "./actions";

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const result = await uploadAuditImageAction(formData);
  if (result.error || !result.url) throw new Error(result.error ?? "Upload failed.");
  return result.url;
}

interface Site {
  id: string;
  name: string;
  company_id: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit Audit"}</PrimaryButton>;
}

export function CreateAuditForm({
  companies,
  sites,
}: {
  companies: { id: string; name: string }[];
  sites: Site[];
}) {
  const [state, formAction] = useActionState<CreateAuditState, FormData>(createAuditAction, {});
  const router = useRouter();

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
  const [siteName, setSiteName] = useState("");
  const siteOptions = useMemo(() => sites.filter((s) => s.company_id === companyId), [sites, companyId]);
  const [images, setImages] = useState<string[]>([]);

  useEffect(() => {
    if (state.success) {
      const timeout = setTimeout(() => router.push("/audits"), 1400);
      return () => clearTimeout(timeout);
    }
  }, [state.success, router]);

  if (state.success) return <SuccessOverlay message="Audit Submitted" />;

  return (
    <form action={formAction} className="flex flex-col gap-3.5">
      <div>
        <FieldLabel>Audit Title</FieldLabel>
        <TextInput name="title" placeholder="e.g. Weekly perimeter audit" required />
      </div>
      <div>
        <FieldLabel>Company</FieldLabel>
        <select
          name="companyId"
          required
          value={companyId}
          onChange={(e) => {
            setCompanyId(e.target.value);
            setSiteName("");
          }}
          className="w-full rounded-lg border border-border bg-bg px-4 py-3 text-[15px] text-text-dark outline-none focus:border-primary"
        >
          <option value="">Select company</option>
          {uniqueCompanies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <FieldLabel>Description</FieldLabel>
        <TextArea name="description" rows={3} placeholder="What did you check?" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FieldLabel>Date</FieldLabel>
          <TextInput type="date" name="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div>
          <FieldLabel>Priority</FieldLabel>
          <select name="priority" defaultValue="medium" className="w-full rounded-lg border border-border bg-bg px-4 py-3 text-[15px] text-text-dark outline-none focus:border-primary">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
      </div>
      <div>
        <FieldLabel>Site</FieldLabel>
        <select
          name="location"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
          className="w-full rounded-lg border border-border bg-bg px-4 py-3 text-[15px] text-text-dark outline-none focus:border-primary"
        >
          <option value="">{siteOptions.length === 0 ? "No sites for this company" : "Select a site"}</option>
          {siteOptions.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
      </div>
      <div>
        <FieldLabel>Notes</FieldLabel>
        <TextArea name="notes" rows={3} placeholder="Anything else the admin should know" />
      </div>

      <div>
        <FieldLabel>Images</FieldLabel>
        <ImagePicker images={images} onChange={setImages} uploadFile={uploadFile} />
        {images.map((url) => (
          <input key={url} type="hidden" name="images" value={url} />
        ))}
      </div>

      {state.error && (
        <div className="rounded-lg bg-error/10 px-3 py-2 text-[12.5px] text-error">{state.error}</div>
      )}

      <SubmitButton />
    </form>
  );
}
