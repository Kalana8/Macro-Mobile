"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";
import { COORDS_MISSING_MESSAGE, coordsMissing, readCoord } from "@/lib/coords";
import { uploadImageToImageKit } from "@macro/shared/imagekit";

export interface CompanyFormState {
  error?: string;
  success?: boolean;
}

/** Uploads a company logo to ImageKit and returns its public URL — keeps the private key server-only. */
export async function uploadCompanyLogoAction(formData: FormData): Promise<{ url?: string; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided." };

  try {
    const url = await uploadImageToImageKit(file, "company-logos");
    return { url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }
}

/** Case-insensitive exact-name check, surfaced by the "Check Name" button before Add Company is submitted. */
export async function checkCompanyNameAction(name: string): Promise<{ exists: boolean }> {
  const trimmed = name.trim();
  if (!trimmed) return { exists: false };

  const supabase = await createClient();
  const { data } = await supabase.from("companies").select("id").ilike("name", trimmed).limit(1);

  return { exists: (data?.length ?? 0) > 0 };
}

export async function createCompanyAction(
  _prev: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const logo = String(formData.get("logo") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "active");

  // The first site is created alongside the company — Site Name plus its
  // geographic coordinates (never trust these for anything other than
  // convenience; they're re-validated server-side at every login/clock-in).
  // `location` is a free-text address, display-only — not used for the geofence.
  const siteName = String(formData.get("siteName") ?? "").trim();
  const siteLat = readCoord(formData.get("siteLat"));
  const siteLng = readCoord(formData.get("siteLng"));

  if (!name) return { error: "Company name is required." };
  if (!siteName) return { error: "Site name is required." };
  if (coordsMissing(siteLat, siteLng)) {
    return { error: COORDS_MISSING_MESSAGE };
  }

  const supabase = await createClient();
  // One company per name: adding "Seoul Garden" again adds the new site to the
  // existing Seoul Garden, so its company page shows every site.
  const { data: existing } = await supabase.from("companies").select("id, logo, location").ilike("name", name.replace(/[\\%_]/g, "\\$&")).limit(1).maybeSingle();
  let company: { id: string };
  if (existing) {
    company = { id: existing.id };
    const fill: Record<string, string> = {};
    if (!existing.logo && logo) fill.logo = logo;
    if (!existing.location && location) fill.location = location;
    if (Object.keys(fill).length) await supabase.from("companies").update(fill).eq("id", existing.id);
  } else {
    const { data, error } = await supabase.from("companies").insert({ name, location, logo, status }).select("id").single();
    if (error || !data) return { error: error?.message ?? "Couldn't create the company." };
    company = data;
  }

  const { error: siteError } = await supabase.from("sites").insert({
    company_id: company.id,
    name: siteName,
    address: location,
    lat: siteLat,
    lng: siteLng,
    allowed_radius: 35,
    status: "open",
  });
  if (siteError) return { error: existing ? `Couldn't add the site to ${name}: ${siteError.message}` : `Company created, but the site failed to save: ${siteError.message}` };
  revalidatePath(`/companies/${company.id}`);

  revalidatePath("/companies");
  return { success: true };
}

export async function updateCompanyAction(
  _prev: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const logo = String(formData.get("logo") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "active");

  // The site whose location was set on the map (one of this company's).
  const siteId = String(formData.get("siteId") ?? "");
  const siteLat = readCoord(formData.get("siteLat"));
  const siteLng = readCoord(formData.get("siteLng"));
  const siteAddress = String(formData.get("siteAddress") ?? "").trim() || null;

  if (!id || !name) return { error: "Company name is required." };
  if (siteId && coordsMissing(siteLat, siteLng)) return { error: COORDS_MISSING_MESSAGE };
  if (siteId && (siteLat < -90 || siteLat > 90 || siteLng < -180 || siteLng > 180)) {
    return { error: "Coordinates look invalid. Latitude must be -90..90, longitude -180..180." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ name, location, logo, status })
    .eq("id", id);

  if (error) return { error: /companies_name_unique|duplicate key/i.test(error.message) ? `There's already a company called "${name}".` : error.message };

  if (siteId) {
    const { data: moved, error: siteError } = await supabase
      .from("sites")
      .update({ address: siteAddress, lat: siteLat, lng: siteLng })
      .eq("id", siteId)
      .eq("company_id", id)
      .select("id");
    if (siteError) return { error: `Company saved, but the site's location wasn't: ${siteError.message}` };
    if (!moved?.length) return { error: "Company saved, but that site isn't part of this company." };
    revalidatePath(`/companies/${id}`);
  }

  revalidatePath("/companies");
  return { success: true };
}

export async function deleteCompanyAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("companies").delete().eq("id", id);

  revalidatePath("/companies");
}

export async function assignEmployeeToCompanyAction(formData: FormData): Promise<void> {
  const companyId = String(formData.get("companyId") ?? "");
  const siteId = String(formData.get("siteId") ?? "") || null;
  const employeeIds = formData.getAll("employeeIds").map(String);
  if (!companyId || employeeIds.length === 0) return;

  const supabase = await createClient();
  await supabase
    .from("employee_companies")
    .upsert(employeeIds.map((employee_id) => ({ employee_id, company_id: companyId })));
  // Only the site they were added to, never the company's other sites
  // (migration 0062). "All sites" adds each of the company's current sites.
  const { data: companySites } = await supabase.from("sites").select("id").eq("company_id", companyId);
  const siteIds = siteId ? [siteId] : (companySites ?? []).map((s) => s.id as string);
  if (siteIds.length) {
    await supabase.from("employee_sites").upsert(employeeIds.flatMap((employee_id) => siteIds.map((site_id) => ({ employee_id, site_id }))));
  }

  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);
}

/**
 * Takes an employee off one site, or off the whole company. Once they're on
 * none of the company's sites they leave the company too.
 */
export async function removeEmployeeFromCompanyAction(formData: FormData): Promise<void> {
  const companyId = String(formData.get("companyId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  const siteId = String(formData.get("siteId") ?? "") || null;
  if (!companyId || !employeeId) return;

  const supabase = await createClient();
  const { data: sites } = await supabase.from("sites").select("id").eq("company_id", companyId);
  const siteIds = (sites ?? []).map((s) => s.id as string);
  let leaveCompany = true;

  if (siteId) {
    const { data: links, error } = await supabase.from("employee_sites").select("site_id").eq("employee_id", employeeId).in("site_id", siteIds);
    if (!error) {
      await supabase.from("employee_sites").delete().eq("employee_id", employeeId).eq("site_id", siteId);
      // Still at another of the company's sites: they stay in the company.
      leaveCompany = !(links ?? []).some((l) => l.site_id !== siteId);
    }
  } else if (siteIds.length) {
    await supabase.from("employee_sites").delete().eq("employee_id", employeeId).in("site_id", siteIds);
  }

  if (leaveCompany) {
    await supabase.from("employee_companies").delete().eq("company_id", companyId).eq("employee_id", employeeId);
  }

  revalidatePath("/companies");
  revalidatePath(`/companies/${companyId}`);
}
