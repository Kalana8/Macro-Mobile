"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";
import { COORDS_MISSING_MESSAGE, coordsMissing, readCoord } from "@/lib/coords";

export interface SiteFormState {
  error?: string;
  success?: boolean;
}

export async function createSiteAction(_prev: SiteFormState, formData: FormData): Promise<SiteFormState> {
  const companyId = String(formData.get("companyId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "open");
  const lat = readCoord(formData.get("lat"));
  const lng = readCoord(formData.get("lng"));
  const allowedRadius = Number(formData.get("allowedRadius") ?? 35);
  const clockInByRaw = String(formData.get("clockInBy") ?? "");
  const clockInBy = /^\d{1,2}$/.test(clockInByRaw) && Number(clockInByRaw) <= 23 ? Number(clockInByRaw) : null;

  if (!companyId || !name) return { error: "Site name is required." };
  if (coordsMissing(lat, lng)) {
    return { error: COORDS_MISSING_MESSAGE };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: "Coordinates look invalid. Latitude must be -90..90, longitude -180..180." };
  }
  if (Number.isNaN(allowedRadius) || allowedRadius <= 0) {
    return { error: "Geofence radius must be a positive number of meters." };
  }

  const supabase = await createClient();
  const row = { company_id: companyId, name, address, lat, lng, status, allowed_radius: allowedRadius };
  let { error } = await supabase.from("sites").insert({ ...row, clock_in_by: clockInBy });
  // Before migration 0073 there's no clock-in-by time.
  if (error && /clock_in_by/.test(error.message)) ({ error } = await supabase.from("sites").insert(row));

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
  const lat = readCoord(formData.get("lat"));
  const lng = readCoord(formData.get("lng"));
  const allowedRadius = Number(formData.get("allowedRadius") ?? 35);
  const clockInByRaw = String(formData.get("clockInBy") ?? "");
  const clockInBy = /^\d{1,2}$/.test(clockInByRaw) && Number(clockInByRaw) <= 23 ? Number(clockInByRaw) : null;

  if (!id || !name) return { error: "Site name is required." };
  if (coordsMissing(lat, lng)) {
    return { error: COORDS_MISSING_MESSAGE };
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { error: "Coordinates look invalid. Latitude must be -90..90, longitude -180..180." };
  }
  if (Number.isNaN(allowedRadius) || allowedRadius <= 0) {
    return { error: "Geofence radius must be a positive number of meters." };
  }

  const supabase = await createClient();
  const changes = { name, address, lat, lng, status, allowed_radius: allowedRadius };
  let { error } = await supabase.from("sites").update({ ...changes, clock_in_by: clockInBy }).eq("id", id);
  // Before migration 0073 there's no clock-in-by time.
  if (error && /clock_in_by/.test(error.message)) ({ error } = await supabase.from("sites").update(changes).eq("id", id));

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
