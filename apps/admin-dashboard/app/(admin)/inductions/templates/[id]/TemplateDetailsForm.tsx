"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import { Badge, Card, FieldLabel, PrimaryButton, Select, TextArea, TextInput } from "@/components/ui";
import type { InductionTemplate } from "@macro/shared/types";
import { updateTemplateDetailsAction, type TemplateFormState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : "Save Details"}</PrimaryButton>;
}

export function TemplateDetailsForm({ template }: { template: InductionTemplate }) {
  const [state, formAction] = useActionState<TemplateFormState, FormData>(updateTemplateDetailsAction, {});
  const [coverPreview, setCoverPreview] = useState<string | null>(template.cover_image_url);
  const [removeCover, setRemoveCover] = useState(false);

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-bold text-text-dark">Assignment Details</div>
        <Badge tone={template.status === "published" ? "success" : "neutral"}>{template.status === "published" ? "Published" : "Draft"}</Badge>
      </div>
      <form action={formAction} className="flex flex-col gap-3" encType="multipart/form-data">
        <input type="hidden" name="id" value={template.id} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Name</FieldLabel>
            <TextInput name="name" required defaultValue={template.name} />
          </div>
          <div>
            <FieldLabel>Category</FieldLabel>
            <TextInput name="category" defaultValue={template.category} placeholder="e.g. General Induction, WHS" />
          </div>
        </div>
        <div>
          <FieldLabel>Description / Instructions</FieldLabel>
          <TextArea name="description" rows={2} defaultValue={template.description} />
        </div>
        <div>
          <FieldLabel>Status</FieldLabel>
          <Select name="status" defaultValue={template.status}>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </Select>
        </div>
        <div>
          <FieldLabel>Cover Image (optional)</FieldLabel>
          {coverPreview && !removeCover && (
            <div className="mb-2 flex items-center gap-3">
              <Image src={coverPreview} alt="Cover" width={96} height={54} className="h-14 w-24 rounded-lg object-cover" unoptimized />
              <label className="flex items-center gap-1.5 text-xs font-semibold text-error">
                <input type="checkbox" name="removeCoverImage" checked={removeCover} onChange={(e) => setRemoveCover(e.target.checked)} className="h-3.5 w-3.5" />
                Remove cover image
              </label>
            </div>
          )}
          {(!coverPreview || removeCover) && (
            <input
              type="file"
              name="coverImage"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setCoverPreview(URL.createObjectURL(file));
              }}
              className="w-full rounded-[11px] border border-border bg-bg px-3.5 py-2.5 text-sm text-text-dark outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-text-dark"
            />
          )}
        </div>
        {state.error && <div className="text-[12.5px] text-error-text">{state.error}</div>}
        {state.success && <div className="text-[12.5px] font-semibold text-olive-text">Saved.</div>}
        <div className="flex justify-end">
          <SubmitButton />
        </div>
      </form>
    </Card>
  );
}
