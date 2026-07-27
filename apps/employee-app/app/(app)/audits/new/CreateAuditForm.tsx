"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { FieldLabel, PrimaryButton, TextArea, TextInput } from "@/components/ui";
import { SuccessOverlay } from "@/components/SuccessOverlay";
import { createAuditAction, type CreateAuditState } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Submitting…" : "Submit Audit"}</PrimaryButton>;
}

export function CreateAuditForm({ companies }: { companies: { id: string; name: string }[] }) {
  const [state, formAction] = useActionState<CreateAuditState, FormData>(createAuditAction, {});
  const router = useRouter();

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
        <select name="companyId" required className="w-full rounded-lg border border-border bg-bg px-4 py-3 text-[15px] text-text-dark outline-none focus:border-primary">
          <option value="">Select company</option>
          {companies.map((c) => (
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
        <FieldLabel>Location</FieldLabel>
        <TextInput name="location" placeholder="Site or area" />
      </div>
      <div className="rounded-lg border border-dashed border-border bg-bg px-4 py-3 text-xs text-text-muted">
        Image upload (Camera / Gallery) isn&apos;t wired up yet — coming in a follow-up pass.
      </div>
      <div>
        <FieldLabel>Notes</FieldLabel>
        <TextArea name="notes" rows={3} placeholder="Anything else the admin should know" />
      </div>

      {state.error && (
        <div className="rounded-lg bg-error/10 px-3 py-2 text-[12.5px] text-error">{state.error}</div>
      )}

      <SubmitButton />
    </form>
  );
}
