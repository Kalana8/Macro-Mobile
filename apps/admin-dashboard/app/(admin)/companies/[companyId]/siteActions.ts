"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";

export interface SiteFormState {
  error?: string;
  success?: boolean;
}

export async function createSiteAction(_prev: SiteFormState, formData: FormData): Promise<SiteFormState> {
  const companyId = String(formData.get("companyId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "open");
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));

  if (!companyId || !name) return { error: "Site name is required." };
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { error: "Set the site's coordinates — enter them or use \"Use my current location\"." };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: "Coordinates look invalid. Latitude must be -90..90, longitude -180..180." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sites").insert({ company_id: companyId, name, address, lat, lng, status });

  if (error) return { error: error.message };

  revalidatePath(`/companies/${companyId}`);
  return { success: true };
}

export async function updateSiteAction(_prev: SiteFormState, formData: FormData): Promise<SiteFormState> {
  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("companyId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "open");
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));

  if (!id || !name) return { error: "Site name is required." };
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { error: "Set the site's coordinates — enter them or use \"Use my current location\"." };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: "Coordinates look invalid. Latitude must be -90..90, longitude -180..180." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sites").update({ name, address, lat, lng, status }).eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/companies/${companyId}`);
  return { success: true };
}

export async function deleteSiteAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const companyId = String(formData.get("companyId") ?? "");
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("sites").delete().eq("id", id);

  revalidatePath(`/companies/${companyId}`);
}
