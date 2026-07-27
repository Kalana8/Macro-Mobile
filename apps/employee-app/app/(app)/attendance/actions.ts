"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";
import { withinGeofence } from "@macro/shared/geo";

export interface AttendanceActionState {
  error?: string;
}

/**
 * Clock in — re-runs the geofence check server-side against the chosen
 * site (Architecture Document §8/§9: "never trust a client-only distance
 * calculation for the authoritative clock-in"). The client-side check on
 * the Attendance screen is UX-only; this is the write that matters.
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
  if (!geoVerified) {
    return { error: "You must be within 20m of the site to clock in." };
  }

  const { error: insertError } = await supabase.from("attendance").insert({
    employee_id: user.id,
    company_id: site.company_id,
    site_id: site.id,
    clock_in_at: new Date().toISOString(),
    geo_verified: geoVerified,
    status: "clocked_in",
  });

  if (insertError) return { error: insertError.message };

  revalidatePath("/attendance");
  return {};
}

export async function clockOutAction(
  _prev: AttendanceActionState,
  formData: FormData
): Promise<AttendanceActionState> {
  const attendanceId = String(formData.get("attendanceId") ?? "");
  if (!attendanceId) return { error: "No active clock-in found." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("attendance")
    .update({ clock_out_at: new Date().toISOString(), status: "complete" })
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
