"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";
import { withinGeofence, reverseGeocodeShortName } from "@macro/shared/geo";

export interface AttendanceActionState {
  error?: string;
}

/**
 * Clock in — records the geofence result (Architecture Document §8/§9)
 * alongside the clock-in rather than blocking on it: a mismatch is marked
 * on the attendance row for the admin to see, not rejected or logged out.
 */
export async function clockInAction(
  _prev: AttendanceActionState,
  formData: FormData
): Promise<AttendanceActionState> {
  const siteId = String(formData.get("siteId") ?? "");
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));

  if (!siteId) return { error: "Choose a site first." };
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { error: "Location access is required to clock in." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Log in again." };

  const { data: site, error: siteError } = await supabase
    .from("sites")
    .select("id, company_id, lat, lng")
    .eq("id", siteId)
    .maybeSingle();

  if (siteError || !site) return { error: "Site not found." };

  const geoVerified = withinGeofence(lat, lng, site.lat, site.lng);
  const address = await reverseGeocodeShortName(lat, lng);

  const { error: insertError } = await supabase.from("attendance").insert({
    employee_id: user.id,
    company_id: site.company_id,
    site_id: site.id,
    clock_in_at: new Date().toISOString(),
    geo_verified: geoVerified,
    clock_in_lat: lat,
    clock_in_lng: lng,
    clock_in_address: address,
    status: "clocked_in",
  });

  if (insertError) return { error: insertError.message };

  revalidatePath("/attendance");
  return {};
}

/**
 * Clock out — same as Clock In, records the geofence result rather than
 * blocking on it.
 */
export async function clockOutAction(
  _prev: AttendanceActionState,
  formData: FormData
): Promise<AttendanceActionState> {
  const attendanceId = String(formData.get("attendanceId") ?? "");
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));

  if (!attendanceId) return { error: "No active clock-in found." };
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { error: "Location access is required to clock out." };
  }

  const supabase = await createClient();
  const { data: record, error: fetchError } = await supabase
    .from("attendance")
    .select("site_id, sites(lat, lng)")
    .eq("id", attendanceId)
    .maybeSingle();

  if (fetchError || !record) return { error: "Active attendance record not found." };

  const site = Array.isArray(record.sites) ? record.sites[0] : record.sites;
  const geoVerified = site ? withinGeofence(lat, lng, site.lat, site.lng) : false;
  const address = await reverseGeocodeShortName(lat, lng);

  const { error } = await supabase
    .from("attendance")
    .update({
      clock_out_at: new Date().toISOString(),
      clock_out_lat: lat,
      clock_out_lng: lng,
      clock_out_address: address,
      clock_out_geo_verified: geoVerified,
      status: "complete",
    })
    .eq("id", attendanceId);

  if (error) return { error: error.message };

  revalidatePath("/attendance");
  return {};
}

export async function breakStartAction(
  _prev: AttendanceActionState,
  formData: FormData
): Promise<AttendanceActionState> {
  const attendanceId = String(formData.get("attendanceId") ?? "");
  if (!attendanceId) return { error: "No active clock-in found." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .update({ break_started_at: new Date().toISOString(), status: "on_break" })
    .eq("id", attendanceId);

  if (error) return { error: error.message };

  revalidatePath("/attendance");
  return {};
}

export async function breakEndAction(
  _prev: AttendanceActionState,
  formData: FormData
): Promise<AttendanceActionState> {
  const attendanceId = String(formData.get("attendanceId") ?? "");
  if (!attendanceId) return { error: "No active clock-in found." };

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("attendance")
    .select("break_started_at, total_break_minutes")
    .eq("id", attendanceId)
    .maybeSingle();

  if (!row?.break_started_at) return { error: "No break in progress." };

  const elapsedMinutes = Math.round(
    (Date.now() - new Date(row.break_started_at).getTime()) / 60000
  );

  const { error } = await supabase
    .from("attendance")
    .update({
      break_started_at: null,
      total_break_minutes: row.total_break_minutes + elapsedMinutes,
      status: "clocked_in",
    })
    .eq("id", attendanceId);

  if (error) return { error: error.message };

  revalidatePath("/attendance");
  return {};
}
