"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";

export interface CompanyFormState {
  error?: string;
  success?: boolean;
}

function parseVisitDays(formData: FormData): number[] {
  return formData
    .getAll("visitDays")
    .map((v) => Number(v))
    .filter((n) => !Number.isNaN(n));
}

export async function createCompanyAction(
  _prev: CompanyFormState,
  formData: FormData
): Promise<CompanyFormState> {
  const name = String(formData.get("name") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "active");
  const visitTime = String(formData.get("visitTime") ?? "") || null;

  // The first site is created alongside the company — Site Name plus its
  // geographic coordinates (never trust these for anything other than
  // convenience; they're re-validated server-side at every login/clock-in).
  // `location` is a free-text address, display-only — not used for the geofence.
  const siteName = String(formData.get("siteName") ?? "").trim();
  const siteLat = Number(formData.get("siteLat"));
  const siteLng = Number(formData.get("siteLng"));

  if (!name) return { error: "Company name is required." };
  if (!siteName) return { error: "Site name is required." };
  if (Number.isNaN(siteLat) || Number.isNaN(siteLng)) {
    return { error: "Set the site's location — enter coordinates or use \"Use my current location\"." };
  }

  const supabase = await createClient();
  const { data: company, error } = await supabase
    .from("companies")
    .insert({
      name,
      location,
      status,
      visit_days: parseVisitDays(formData),
      visit_time: visitTime,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  const { error: siteError } = await supabase.from("sites").insert({
    company_id: company.id,
    name: siteName,
    address: location,
    lat: siteLat,
    lng: siteLng,
    status: "open",
  });
  if (siteError) return { error: `Company created, but the site failed to save: ${siteError.message}` };

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
  const status = String(formData.get("status") ?? "active");
  const visitTime = String(formData.get("visitTime") ?? "") || null;

  if (!id || !name) return { error: "Company name is required." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("companies")
    .update({ name, location, status, visit_days: parseVisitDays(formData), visit_time: visitTime })
    .eq("id", id);

  if (error) return { error: error.message };

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
  const employeeIds = formData.getAll("employeeIds").map(String);
  if (!companyId || employeeIds.length === 0) return;

  const supabase = await createClient();
  await supabase
    .from("employee_companies")
    .upsert(employeeIds.map((employee_id) => ({ employee_id, company_id: companyId })));

  revalidatePath(`/companies/${companyId}`);
}

export async function removeEmployeeFromCompanyAction(formData: FormData): Promise<void> {
  const companyId = String(formData.get("companyId") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!companyId || !employeeId) return;

  const supabase = await createClient();
  await supabase
    .from("employee_companies")
    .delete()
    .eq("company_id", companyId)
    .eq("employee_id", employeeId);

  revalidatePath(`/companies/${companyId}`);
}
