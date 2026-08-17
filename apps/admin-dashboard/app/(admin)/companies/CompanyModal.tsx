"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "@/components/Modal";
import { LocationField } from "@/components/LocationField";
import { ImagePicker } from "@/components/ImagePicker";
import { FieldLabel, PrimaryButton, Select, TextInput } from "@/components/ui";
import { SiteDetailsPopup } from "./SiteDetailsPopup";
import {
  checkCompanyNameAction,
  createCompanyAction,
  updateCompanyAction,
  uploadCompanyLogoAction,
  type CompanyFormState,
} from "./actions";
import { createSiteAction } from "./[companyId]/siteActions";
import type { Company, Site } from "@macro/shared/types";

async function uploadFile(file: File): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  const result = await uploadCompanyLogoAction(formData);
  if (result.error || !result.url) throw new Error(result.error ?? "Upload failed.");
  return result.url;
}

function SubmitButton({ label, disabled }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending || disabled}>{pending ? "Saving…" : label}</PrimaryButton>;
}

const OTHER_COMPANY = "__other_company__";
const OTHER_SITE = "__other_site__";

export function CompanyModal({
  company,
  companies = [],
  existingSiteNames = [],
  sitesByCompany = {},
  onClose,
}: {
  company?: Company;
  companies?: Company[];
  existingSiteNames?: string[];
  sitesByCompany?: Record<string, Site[]>;
  onClose: () => void;
}) {
  const isEdit = Boolean(company);

  // Picking an existing company (instead of "Other") switches this modal
  // from "create a company" into "add a site to that existing company".
  const [companyChoice, setCompanyChoice] = useState("");
  const isAddSiteMode = !isEdit && companyChoice !== "" && companyChoice !== OTHER_COMPANY;
  const showCompanyOnlyFields = !isEdit && companyChoice === OTHER_COMPANY;
  const showSiteFields = !isEdit && companyChoice !== "";

  const action = isEdit ? updateCompanyAction : isAddSiteMode ? createSiteAction : createCompanyAction;
  const [state, formAction] = useActionState<CompanyFormState, FormData>(action, {});

  const [customCompanyName, setCustomCompanyName] = useState("");
  const [checkingName, setCheckingName] = useState(false);
  const [nameCheck, setNameCheck] = useState<"idle" | "clear" | "duplicate">("idle");
  const [logo, setLogo] = useState<string | null>(company?.logo ?? null);

  // Site name — pick an existing name to reuse (a company can have more than
  // one site row with the same name, e.g. two desks in different buildings),
  // or "Other" to type a brand-new name. Scoped to the chosen company's own
  // sites in "add site" mode, or the global list otherwise.
  const [siteNameChoice, setSiteNameChoice] = useState("");
  const [customSiteName, setCustomSiteName] = useState("");
  const siteName = siteNameChoice === OTHER_SITE ? customSiteName : siteNameChoice;
  const companySites = isAddSiteMode ? sitesByCompany[companyChoice] ?? [] : [];
  // A company can have more than one site row sharing a name (see above), so
  // dedupe here — the dropdown offers each distinct name once, regardless of
  // how many existing site rows already use it.
  const siteNameOptions = Array.from(
    new Set(isAddSiteMode ? companySites.map((s) => s.name) : existingSiteNames)
  );
  const pickedExistingSite = siteNameChoice !== "" && siteNameChoice !== OTHER_SITE;
  // Every existing site row sharing the picked name — same physical site, so
  // its address auto-fills below and the existing entries are listed so the
  // admin can tell they're adding another one rather than the first.
  const matchingSites = pickedExistingSite && isAddSiteMode ? companySites.filter((s) => s.name === siteNameChoice) : [];
  const [viewingSite, setViewingSite] = useState<Site | null>(null);

  useEffect(() => {
    if (state.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  async function handleCheckName() {
    if (!customCompanyName.trim()) return;
    setCheckingName(true);
    try {
      const { exists } = await checkCompanyNameAction(customCompanyName);
      setNameCheck(exists ? "duplicate" : "clear");
    } finally {
      setCheckingName(false);
    }
  }

  const selectedCompany = companies.find((c) => c.id === companyChoice);
  const modalTitle = isEdit ? "Edit Company" : isAddSiteMode ? `Add Site to ${selectedCompany?.name ?? "Company"}` : "Add Company";
  const submitLabel = isEdit ? "Save Changes" : isAddSiteMode ? "Add Site" : "Register";

  return (
    <>
    <Modal title={modalTitle} onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-3.5">
        {isEdit && <input type="hidden" name="id" value={company!.id} />}
        {isAddSiteMode && <input type="hidden" name="companyId" value={companyChoice} />}

        <div>
          <FieldLabel>Company Name</FieldLabel>
          {isEdit ? (
            <TextInput name="name" required defaultValue={company?.name ?? ""} placeholder="e.g. Acme Corp" />
          ) : (
            <>
              <Select
                value={companyChoice}
                onChange={(e) => {
                  setCompanyChoice(e.target.value);
                  setSiteNameChoice("");
                  setCustomSiteName("");
                }}
              >
                <option value="">Select a company or add new</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value={OTHER_COMPANY}>Other — add a new company</option>
              </Select>
              {showCompanyOnlyFields && (
                <>
                  <TextInput
                    name="name"
                    required
                    className="mt-2"
                    value={customCompanyName}
                    onChange={(e) => {
                      setCustomCompanyName(e.target.value);
                      setNameCheck("idle");
                    }}
                    placeholder="e.g. Acme Corp"
                  />
                  <button
                    type="button"
                    onClick={handleCheckName}
                    disabled={checkingName || !customCompanyName.trim()}
                    className="mt-1.5 text-[12.5px] font-semibold text-primary disabled:opacity-40"
                  >
                    {checkingName ? "Checking…" : "Check Name"}
                  </button>
                  {nameCheck === "duplicate" && (
                    <p className="mt-1 text-[11.5px] text-[#B35A10]">
                      A company named &quot;{customCompanyName}&quot; already exists. You can continue anyway, or use a different name.
                    </p>
                  )}
                  {nameCheck === "clear" && (
                    <p className="mt-1 text-[11.5px] text-olive-text">No existing company has this name.</p>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {showSiteFields && (
          <div>
            <FieldLabel>Site Name</FieldLabel>
            <input type="hidden" name={isAddSiteMode ? "name" : "siteName"} value={siteName} />
            <Select value={siteNameChoice} onChange={(e) => setSiteNameChoice(e.target.value)}>
              <option value="">{siteNameOptions.length === 0 ? "No existing sites — add one below" : "Select a site name"}</option>
              {siteNameOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
              <option value={OTHER_SITE}>Other — add a new site name</option>
            </Select>
            {matchingSites.length > 0 && (
              <div className="mt-2 rounded-xl border border-border p-2.5">
                <p className="mb-2 text-[11.5px] text-text-muted">
                  Address auto-filled below. &quot;{siteNameChoice}&quot; already exists
                  {matchingSites.length > 1 ? ` (${matchingSites.length} sites)` : ""} for this company —
                  you&apos;re adding another one.
                </p>
                <div className="flex flex-col gap-1.5">
                  {matchingSites.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg bg-bg px-3 py-2">
                      <span className="text-[12.5px] font-semibold text-text-dark">{s.address || "No address set"}</span>
                      <button
                        type="button"
                        onClick={() => setViewingSite(s)}
                        className="text-[12px] font-bold text-primary"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {siteNameChoice === OTHER_SITE && (
              <TextInput
                className="mt-2"
                value={customSiteName}
                onChange={(e) => setCustomSiteName(e.target.value)}
                placeholder="e.g. Main Office"
                required
              />
            )}
          </div>
        )}

        {isEdit ? (
          <div>
            <FieldLabel>Location</FieldLabel>
            <TextInput name="location" defaultValue={company?.location ?? ""} placeholder="e.g. 123 Main St, Colombo (optional)" />
          </div>
        ) : isAddSiteMode ? (
          <LocationField
            key={matchingSites[0]?.id ?? "new"}
            addressFieldName="address"
            latFieldName="lat"
            lngFieldName="lng"
            initialAddress={matchingSites[0]?.address ?? ""}
            initialLat={matchingSites[0]?.lat}
            initialLng={matchingSites[0]?.lng}
            helpText="Type an address (auto-located) or stand at the site and use your current location. Used for the 20m geofenced login/clock-in."
          />
        ) : showCompanyOnlyFields ? (
          <LocationField addressFieldName="location" latFieldName="siteLat" lngFieldName="siteLng" />
        ) : null}

        {(isEdit || showCompanyOnlyFields) && (
          <div>
            <FieldLabel>Status</FieldLabel>
            <Select name="status" defaultValue={company?.status ?? "active"}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        )}

        {(isEdit || showCompanyOnlyFields) && (
          <div>
            <FieldLabel>Company Logo</FieldLabel>
            <input type="hidden" name="logo" value={logo ?? ""} />
            <ImagePicker
              images={logo ? [logo] : []}
              onChange={(images) => setLogo(images[images.length - 1] ?? null)}
              uploadFile={uploadFile}
            />
          </div>
        )}

        {state.error && <div className="text-[12.5px] text-error-text">{state.error}</div>}

        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-[12px] border border-border px-4 py-2.5 text-sm font-semibold text-text-dark">
            Cancel
          </button>
          <SubmitButton label={submitLabel} />
        </div>
      </form>
    </Modal>
    {viewingSite && <SiteDetailsPopup site={viewingSite} onClose={() => setViewingSite(null)} />}
    </>
  );
}
