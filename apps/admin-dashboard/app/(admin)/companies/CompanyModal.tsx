"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { LocationField } from "@/components/LocationField";
import { ImagePicker } from "@/components/ImagePicker";
import { FieldLabel, PrimaryButton, Select, TextInput } from "@/components/ui";
import {
  checkCompanyNameAction,
  createCompanyAction,
  updateCompanyAction,
  uploadCompanyLogoAction,
  type CompanyFormState,
} from "./actions";
import type { Company } from "@macro/shared/types";

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const result = await uploadCompanyLogoAction(formData);
  if (result.error || !result.url) throw new Error(result.error ?? "Upload failed.");
  return result.url;
}

const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Saving…" : label}</PrimaryButton>;
}

export function CompanyModal({ company, onClose }: { company?: Company; onClose: () => void }) {
  const isEdit = Boolean(company);
  const action = isEdit ? updateCompanyAction : createCompanyAction;
  const [state, formAction] = useActionState<CompanyFormState, FormData>(action, {});
  // 4 rows x 7 columns = 28 independently-toggleable cells (matches the
  // original mockup's grid). Each cell's weekday is cellIndex % 7; the
  // saved visit_days value is the deduped set of weekdays across whichever
  // cells are selected — the 4 rows are just a visual grid, not 4 separate weeks.
  const [selectedCells, setSelectedCells] = useState<number[]>(company?.visit_days ?? []);
  const [name, setName] = useState(company?.name ?? "");
  const [checkingName, setCheckingName] = useState(false);
  const [nameCheck, setNameCheck] = useState<"idle" | "clear" | "duplicate">("idle");
  const [logo, setLogo] = useState<string | null>(company?.logo ?? null);

  useEffect(() => {
    if (state.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  // Each of the 28 cells toggles independently — selecting one cell must
  // never select the other cells that happen to share the same weekday.
  function toggleCell(cellIndex: number) {
    setSelectedCells((prev) =>
      prev.includes(cellIndex) ? prev.filter((c) => c !== cellIndex) : [...prev, cellIndex]
    );
  }

  async function handleCheckName() {
    if (!name.trim()) return;
    setCheckingName(true);
    try {
      const { exists } = await checkCompanyNameAction(name);
      setNameCheck(exists ? "duplicate" : "clear");
    } finally {
      setCheckingName(false);
    }
  }

  return (
    <Modal title={isEdit ? "Edit Company" : "Add Company"} onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        {isEdit && <input type="hidden" name="id" value={company!.id} />}

        <div>
          <FieldLabel>Company Name</FieldLabel>
          <TextInput
            name="name"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameCheck("idle");
            }}
            placeholder="e.g. Acme Corp"
          />
          {!isEdit && (
            <>
              <button
                type="button"
                onClick={handleCheckName}
                disabled={checkingName || !name.trim()}
                className="mt-1.5 text-[12.5px] font-semibold text-primary disabled:opacity-40"
              >
                {checkingName ? "Checking…" : "Check Name"}
              </button>
              {nameCheck === "duplicate" && (
                <p className="mt-1 text-[11.5px] text-[#B35A10]">
                  A company named &quot;{name}&quot; already exists. You can continue anyway, or use a different name.
                </p>
              )}
              {nameCheck === "clear" && (
                <p className="mt-1 text-[11.5px] text-olive-text">No existing company has this name.</p>
              )}
            </>
          )}
        </div>

        {!isEdit && (
          <div>
            <FieldLabel>Site Name</FieldLabel>
            <TextInput name="siteName" required placeholder="e.g. Main Office" />
          </div>
        )}

        {isEdit ? (
          <div>
            <FieldLabel>Location</FieldLabel>
            <TextInput name="location" defaultValue={company?.location ?? ""} placeholder="e.g. 123 Main St, Colombo (optional)" />
          </div>
        ) : (
          <LocationField addressFieldName="location" latFieldName="siteLat" lngFieldName="siteLng" />
        )}

        <div>
          <FieldLabel>Status</FieldLabel>
          <Select name="status" defaultValue={company?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        <div>
          <FieldLabel>Company Logo</FieldLabel>
          <input type="hidden" name="logo" value={logo ?? ""} />
          <ImagePicker
            images={logo ? [logo] : []}
            onChange={(images) => setLogo(images[images.length - 1] ?? null)}
            uploadFile={uploadFile}
          />
        </div>

        <div>
          <FieldLabel>Visit Days &amp; Time</FieldLabel>
          <div className="rounded-xl border border-border p-3">
            <div className="grid grid-cols-7 gap-1.5">
              {Array.from({ length: 28 }, (_, cellIndex) => {
                const active = selectedCells.includes(cellIndex);
                return (
                  <button
                    type="button"
                    key={cellIndex}
                    onClick={() => toggleCell(cellIndex)}
                    className={`rounded-lg py-2.5 text-xs font-bold ${
                      active ? "bg-primary text-white" : "bg-bg text-text-muted"
                    }`}
                  >
                    {DAY_LETTERS[cellIndex % 7]}
                  </button>
                );
              })}
            </div>
            <div className="mt-3">
              <TextInput type="time" name="visitTime" defaultValue={company?.visit_time ?? ""} />
            </div>
          </div>
          {Array.from(new Set(selectedCells.map((c) => c % 7))).map((weekday) => (
            <input key={weekday} type="hidden" name="visitDays" value={weekday} />
          ))}
        </div>

        {state.error && <div className="text-[12.5px] text-error-text">{state.error}</div>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
            Cancel
          </button>
          <SubmitButton label={isEdit ? "Save Changes" : "Register"} />
        </div>
      </form>
    </Modal>
  );
}
