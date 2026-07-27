"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import type { Site } from "@macro/shared/types";
import { Modal } from "@/components/Modal";
import { LocationField } from "@/components/LocationField";
import { FieldLabel, PrimaryButton, TextInput } from "@/components/ui";
import { createSiteAction, updateSiteAction, type SiteFormState } from "./siteActions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : label}</PrimaryButton>;
}

export function SiteModal({
  companyId,
  site,
  onClose,
}: {
  companyId: string;
  site?: Site;
  onClose: () => void;
}) {
  const isEdit = Boolean(site);
  const action = isEdit ? updateSiteAction : createSiteAction;
  const [state, formAction] = useActionState<SiteFormState, FormData>(action, {});
  const [status, setStatus] = useState(site?.status ?? "open");

  useEffect(() => {
    if (state.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <Modal title={isEdit ? "Edit Site" : "Add Site"} onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        <input type="hidden" name="companyId" value={companyId} />
        {isEdit && <input type="hidden" name="id" value={site!.id} />}
        <input type="hidden" name="status" value={status} />

        <div>
          <FieldLabel>Site Name</FieldLabel>
          <TextInput name="name" required defaultValue={site?.name} placeholder="e.g. Main Office" />
        </div>
        <LocationField
          addressFieldName="address"
          latFieldName="lat"
          lngFieldName="lng"
          initialAddress={site?.address ?? ""}
          initialLat={site?.lat}
          initialLng={site?.lng}
          helpText="Type an address (auto-located) or stand at the site and use your current location. Used for the 20m geofenced login/clock-in."
        />

        <div>
          <FieldLabel>Status</FieldLabel>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStatus("open")}
              className={`flex-1 rounded-[10px] py-2.5 text-[13px] font-bold ${status === "open" ? "bg-primary text-white" : "bg-bg text-text-muted"}`}
            >
              Open
            </button>
            <button
              type="button"
              onClick={() => setStatus("closed")}
              className={`flex-1 rounded-[10px] py-2.5 text-[13px] font-bold ${status === "closed" ? "bg-text-muted text-white" : "bg-bg text-text-muted"}`}
            >
              Closed
            </button>
          </div>
        </div>

        {state.error && <div className="text-[12.5px] text-error-text">{state.error}</div>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
            Cancel
          </button>
          <SubmitButton label={isEdit ? "Save Changes" : "Add Site"} />
        </div>
      </form>
    </Modal>
  );
}
