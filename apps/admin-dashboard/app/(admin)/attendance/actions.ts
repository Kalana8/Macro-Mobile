"use server";

import { createClient } from "@macro/shared/supabase/server";
import { businessDayRange } from "@macro/shared/datetime";
import { getCurrentAdmin } from "@/lib/session";
import { toReportRows, type AttendanceReportRow, type RawAttendance } from "@/lib/attendanceReport";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 5000;

/**
 * Shifts for the attendance report. With no companies or employees chosen it
 * covers everyone. Days are Sydney business days, matched on clock-in time.
 */
export async function attendanceReportAction(params: {
  from: string;
  to: string;
  companyIds?: string[];
  employeeIds?: string[];
}): Promise<{ rows?: AttendanceReportRow[]; truncated?: boolean; error?: string }> {
  const admin = await getCurrentAdmin();
  if (!admin?.employee) return { error: "Not signed in." };
  if (!DAY.test(params.from) || !DAY.test(params.to)) return { error: "Choose a start and end date." };
  if (params.from > params.to) return { error: "The start date is after the end date." };

  const range = businessDayRange(params.from, params.to);
  const supabase = await createClient();
  let query = supabase
    .from("attendance")
    .select("clock_in_at, clock_out_at, total_break_minutes, status, geo_verified, clock_out_geo_verified, employees(full_name), companies(name), sites(name)")
    .gte("clock_in_at", range.start)
    .lt("clock_in_at", range.end)
    .order("clock_in_at")
    .limit(MAX_ROWS + 1);
  if (params.companyIds?.length) query = query.in("company_id", params.companyIds);
  if (params.employeeIds?.length) query = query.in("employee_id", params.employeeIds);

  const { data, error } = await query;
  if (error) return { error: error.message };
  const raw = (data ?? []) as unknown as RawAttendance[];
  return { rows: toReportRows(raw.slice(0, MAX_ROWS)), truncated: raw.length > MAX_ROWS };
}
