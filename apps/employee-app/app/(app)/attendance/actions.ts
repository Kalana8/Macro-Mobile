"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";
import { haversineDistanceMeters, reverseGeocodeShortName } from "@macro/shared/geo";

export interface AttendanceActionState {
  error?: string;
  /** Set when clock in/out succeeded but outside the site's geofence — the action still completes (the shift/timer starts or ends normally), but the UI shows a red warning alongside it rather than silently accepting it. */
  locationMismatch?: { distanceM: number; radiusM: number };
}

/**
 * Clock in — always completes (the shift starts either way), but the
 * geofence is re-checked server-side against the site's own allowed_radius
 * regardless of what the client's earlier site-selection check found, and a
 * mismatch is both recorded on the row (for the admin dashboard) and
 * returned here (for an immediate red warning) rather than silently passing.
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
    .select("id, company_id, lat, lng, allowed_radius")
    .eq("id", siteId)
    .maybeSingle();

  if (siteError || !site) return { error: "Site not found." };

  const distanceM = haversineDistanceMeters(lat, lng, site.lat, site.lng);
  const geoVerified = distanceM <= site.allowed_radius;
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
    clock_in_distance: distanceM,
    status: "clocked_in",
  });

  if (insertError) return { error: insertError.message };

  revalidatePath("/attendance");
  return geoVerified ? {} : { locationMismatch: { distanceM, radiusM: site.allowed_radius } };
}

/**
 * Clock out — an entirely independent geofence check, never assuming that
 * being inside the geofence at Clock In means still inside it now. Same as
 * Clock In: always completes, a mismatch just surfaces as a red warning.
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
    .select("site_id, sites(lat, lng, allowed_radius)")
    .eq("id", attendanceId)
    .maybeSingle();

  if (fetchError || !record) return { error: "Active attendance record not found." };

  const site = Array.isArray(record.sites) ? record.sites[0] : record.sites;
  if (!site) return { error: "Site not found." };

  const distanceM = haversineDistanceMeters(lat, lng, site.lat, site.lng);
  const geoVerified = distanceM <= site.allowed_radius;
  const address = await reverseGeocodeShortName(lat, lng);

  const { error } = await supabase
    .from("attendance")
    .update({
      clock_out_at: new Date().toISOString(),
      clock_out_lat: lat,
      clock_out_lng: lng,
      clock_out_address: address,
      clock_out_distance: distanceM,
      clock_out_geo_verified: geoVerified,
      status: "complete",
    })
    .eq("id", attendanceId);

  if (error) return { error: error.message };

  revalidatePath("/attendance");
  return geoVerified ? {} : { locationMismatch: { distanceM, radiusM: site.allowed_radius } };
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
