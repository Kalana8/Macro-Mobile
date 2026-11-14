"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { createClient } from "@macro/shared/supabase/server";
import { uploadImageToImageKit } from "@macro/shared/imagekit";
import { todayInBusinessTimezone } from "@macro/shared/datetime";
import type { ChecklistArea, SubtaskFrequency } from "@macro/shared/types";
import { areasOn, cycleDays, mondayOf, nextDueDate, WEEKDAY_NAMES } from "@macro/shared/checklistCycle";
import { parseVisitSchedule } from "../companies/scheduleForm";

export interface ChecklistFormState {
  error?: string;
  success?: boolean;
  /** The template that was saved, so the next save from the same form updates it. */
  id?: string;
  /** What happened when sending, e.g. "Sent to 2 employees." */
  message?: string;
}

// ---------------------------------------------------------------------------
// 28-day cycle templates (migration 0055)
// ---------------------------------------------------------------------------

interface DraftCycleSubtask {
  id?: string;
  text: string;
  frequency: SubtaskFrequency;
  weekday?: number;
  weekdays?: number[];
  week?: number;
  days?: number[];
}
interface DraftCycleArea {
  mainArea: string;
  note: string;
  images: string[];
  subtasks: DraftCycleSubtask[];
}
interface DraftCycle {
  start: string;
  repeats: boolean;
  areas: DraftCycleArea[];
}

const FREQUENCIES: SubtaskFrequency[] = ["daily", "weekly", "monthly", "custom"];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const clampInt = (n: unknown, max: number) => Math.min(max, Math.max(0, Math.floor(Number(n) || 0)));

/** Builds the saved areas: names trimmed, empty rows dropped, every subtask's cycle days worked out from its frequency. */
function buildCycleAreas(draft: DraftCycleArea[]): { areas?: ChecklistArea[]; error?: string } {
  const areas: ChecklistArea[] = [];
  for (const a of draft) {
    const name = String(a.mainArea ?? "").trim();
    const subs = (a.subtasks ?? []).filter((s) => String(s.text ?? "").trim());
    if (!name && subs.length === 0) continue;
    if (!name) return { error: "Give every main task a name." };
    if (subs.length === 0) return { error: `Add at least one subtask to “${name}”.` };
    const subtasks = [];
    for (const s of subs) {
      const frequency = FREQUENCIES.includes(s.frequency) ? s.frequency : "daily";
      const weekday = clampInt(s.weekday, 6);
      const weekdays = [...new Set((s.weekdays ?? []).map((d) => clampInt(d, 6)))].sort((a, b) => a - b);
      const week = clampInt(s.week, 3);
      if (frequency === "weekly" && weekdays.length === 0) return { error: `Pick at least one day for “${String(s.text).trim()}”.` };
      const days = cycleDays(frequency, { weekday, weekdays, week, days: (s.days ?? []).map((d) => clampInt(d, 27)) });
      if (days.length === 0) return { error: `Pick at least one day for “${String(s.text).trim()}”.` };
      subtasks.push({
        // Keep ids when editing, so checklists already sent still match.
        id: s.id && /^[\w-]{8,64}$/.test(s.id) ? s.id : randomUUID(),
        text: String(s.text).trim(),
        frequency,
        ...(frequency === "weekly" ? { weekdays } : {}),
        ...(frequency === "monthly" ? { weekday } : {}),
        ...(frequency === "monthly" ? { week } : {}),
        days,
      });
    }
    areas.push({ main_area: name, note: String(a.note ?? "").trim(), images: (a.images ?? []).filter((u) => typeof u === "string"), subtasks });
  }
  if (areas.length === 0) return { error: "Add at least one main task with a subtask." };
  return { areas };
}

/** Saves a 28-day cycle template. */
export async function saveCycleTemplateAction(_prev: ChecklistFormState, formData: FormData): Promise<ChecklistFormState> {
  const companyId = String(formData.get("companyId") ?? "");
  const siteId = String(formData.get("siteId") ?? "").trim();
  const templateId = String(formData.get("templateId") ?? "");
  const specialNote = String(formData.get("specialNote") ?? "").trim() || null;
  if (!companyId || !siteId) return { error: "Company and site are required.", id: templateId || undefined };

  let draft: DraftCycle;
  try {
    draft = JSON.parse(String(formData.get("cycleJson") ?? "{}"));
  } catch {
    return { error: "Invalid checklist data.", id: templateId || undefined };
  }
  if (!ISO.test(draft.start ?? "")) return { error: "Pick the date Week 1 starts.", id: templateId || undefined };
  const built = buildCycleAreas(draft.areas ?? []);
  if (built.error) return { error: built.error, id: templateId || undefined };

  const values = {
    company_id: companyId,
    site_id: siteId,
    special_note: specialNote,
    // Week 1 always starts on a Monday.
    cycle_start: mondayOf(draft.start),
    cycle_repeats: draft.repeats !== false,
    cycle_end: null,
    cycle_areas: built.areas,
    // The older date-based fields aren't used by cycle templates.
    areas: [],
    day_areas: {},
    visit_dates: [],
  };
  const supabase = await createClient();
  const { data, error } = templateId
    ? await supabase.from("checklist_templates").update(values).eq("id", templateId).select("id").single()
    : await supabase.from("checklist_templates").insert(values).select("id").single();
  if (error) {
    const missing = /cycle_/.test(error.message);
    return { error: missing ? "Run migration 0055_checklist_28_day_cycle.sql in Supabase first." : error.message, id: templateId || undefined };
  }
  await refreshTodaysCopies(supabase, data.id as string);
  revalidatePath("/checklists");
  revalidatePath("/companies");
  return { success: true, id: data.id as string };
}

type TemplateRow = {
  site_id: string;
  areas: ChecklistArea[] | null;
  day_areas: Record<string, ChecklistArea[]> | null;
  visit_dates: string[] | null;
  special_note: string | null;
  cycle_start?: string | null;
  cycle_repeats?: boolean;
  cycle_end?: string | null;
  cycle_areas?: ChecklistArea[];
  sites: { name?: string } | { name?: string }[] | null;
};

/** What a template sends on a date, for cycle and older date-based templates alike. */
function areasForDate(t: TemplateRow, iso: string): ChecklistArea[] {
  if (t.cycle_start) return areasOn(t, iso);
  if (!(t.visit_dates ?? []).includes(iso)) return [];
  const dow = new Date(`${iso}T00:00:00`).getDay();
  return (t.day_areas ?? {})[String(dow)] ?? t.areas ?? [];
}

/**
 * Sends today's checklist from a template to employees who haven't had it
 * today. Returns how many got it, or when the next one is due if nothing
 * falls on today.
 */
async function sendToday(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateId: string,
  companyId: string,
  employeeIds: string[],
  adminNote: string | null,
): Promise<{ sent: number; next: string | null; already: number; updated: number }> {
  const { data } = await supabase.from("checklist_templates").select("*, sites(name)").eq("id", templateId).maybeSingle();
  const template = data as TemplateRow | null;
  if (!template) return { sent: 0, next: null, already: 0, updated: 0 };
  const today = todayInBusinessTimezone();
  const areas = areasForDate(template, today);
  if (areas.length === 0) {
    const next = template.cycle_start ? nextDueDate(template, today) : ((template.visit_dates ?? []).filter((d) => d > today).sort()[0] ?? null);
    return { sent: 0, next, already: 0, updated: 0 };
  }

  const { data: existing } = await supabase
    .from("checklists")
    .select("id, employee_id, status")
    .eq("template_id", templateId)
    .eq("assigned_date", today)
    .in("employee_id", employeeIds);
  const alreadySent = new Set((existing ?? []).map((c) => c.employee_id as string));
  // Already sent today but not submitted: bring it up to date with any edits.
  const stale = (existing ?? []).filter((c) => c.status === "pending").map((c) => c.id as string);
  if (stale.length > 0) {
    await supabase.from("checklists").update({ areas, special_note: template.special_note }).in("id", stale);
  }
  const toSend = employeeIds.filter((id) => !alreadySent.has(id));
  if (toSend.length > 0) {
    const site = Array.isArray(template.sites) ? template.sites[0] : template.sites;
    await supabase.from("checklists").insert(
      toSend.map((employee_id) => ({
        template_id: templateId,
        company_id: companyId,
        site: site?.name ?? "",
        site_id: template.site_id,
        employee_id,
        assigned_date: today,
        areas,
        special_note: template.special_note,
        status: "pending",
        admin_note: adminNote,
      })),
    );
  }
  return { sent: toSend.length, next: null, already: alreadySent.size, updated: stale.length };
}

/**
 * After a checklist is edited, today's copies that employees haven't
 * submitted yet are updated to match, so the edits show straight away.
 * Submitted ones stay as they were.
 */
async function refreshTodaysCopies(supabase: Awaited<ReturnType<typeof createClient>>, templateId: string) {
  const { data } = await supabase.from("checklist_templates").select("*, sites(name)").eq("id", templateId).maybeSingle();
  const template = data as TemplateRow | null;
  if (!template) return;
  const today = todayInBusinessTimezone();
  const areas = areasForDate(template, today);
  if (areas.length === 0) return;
  await supabase
    .from("checklists")
    .update({ areas, special_note: template.special_note })
    .eq("template_id", templateId)
    .eq("assigned_date", today)
    .eq("status", "pending");
}

function sendMessage(r: { sent: number; next: string | null; already: number; updated: number }): string {
  const parts: string[] = [];
  if (r.sent > 0) parts.push(`Sent today’s checklist to ${r.sent} employee${r.sent === 1 ? "" : "s"}.`);
  if (r.updated > 0) parts.push(`Updated today’s checklist for ${r.updated} employee${r.updated === 1 ? "" : "s"} who already had it.`);
  if (parts.length) return parts.join(" ");
  if (r.already > 0) return "Today’s checklist was already sent and submitted.";
  if (!r.next) return "Nothing is due on this checklist.";
  // A weekday, not a date: checklists run on Week 1–4, Mon–Sun.
  const weekday = WEEKDAY_NAMES[(new Date(`${r.next}T00:00:00Z`).getUTCDay() + 6) % 7];
  return `Nothing is due today. The first checklist goes out on ${weekday}.`;
}

/** Sends today's checklist for one standing assignment right away. */
export async function sendAssignmentNowAction(assignmentId: string): Promise<ChecklistFormState> {
  if (!assignmentId) return { error: "Missing assignment." };
  const supabase = await createClient();
  const { data: a } = await supabase.from("checklist_assignments").select("template_id, company_id, employee_id, admin_note").eq("id", assignmentId).maybeSingle();
  if (!a) return { error: "This assignment no longer exists." };
  const result = await sendToday(supabase, a.template_id as string, a.company_id as string, [a.employee_id as string], (a.admin_note as string | null) ?? null);
  revalidatePath("/checklists");
  return { success: true, message: sendMessage(result) };
}

interface DraftArea {
  mainArea: string;
  note: string;
  subtasks: string[];
  images: string[];
}

/** Uploads one checklist photo to ImageKit and returns its public URL — keeps the private key server-only. */
export async function uploadChecklistImageAction(formData: FormData): Promise<{ url?: string; error?: string }> {
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file provided." };

  try {
    const url = await uploadImageToImageKit(file, "checklists");
    return { url };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }
}

function buildAreas(draft: DraftArea[]): ChecklistArea[] {
  return draft
    .filter((a) => a.mainArea.trim())
    .map((a) => ({
      main_area: a.mainArea.trim(),
      note: a.note.trim(),
      images: a.images ?? [],
      subtasks: a.subtasks
        .filter((s) => s.trim())
        .map((text) => ({ id: randomUUID(), text: text.trim() })),
    }));
}

/**
 * Saves a template. Always hands back the id it worked on, even when the save
 * fails, so the open form keeps updating one template instead of creating more.
 */
export async function createTemplateAction(prev: ChecklistFormState, formData: FormData): Promise<ChecklistFormState> {
  const result = await saveTemplate(prev, formData);
  return { ...result, id: result.id ?? (String(formData.get("templateId") ?? "") || undefined) };
}

async function saveTemplate(
  _prev: ChecklistFormState,
  formData: FormData
): Promise<ChecklistFormState> {
  const companyId = String(formData.get("companyId") ?? "");
  const siteId = String(formData.get("siteId") ?? "").trim();
  const dayAreasRaw = String(formData.get("dayAreasJson") ?? "{}");
  const templateId = String(formData.get("templateId") ?? "");
  const specialNote = String(formData.get("specialNote") ?? "").trim() || null;

  if (!companyId || !siteId) return { error: "Company and site are required." };

  let dayDraft: Record<string, DraftArea[]>;
  try {
    dayDraft = JSON.parse(dayAreasRaw);
  } catch {
    return { error: "Invalid template data." };
  }
  const dayAreas: Record<string, ChecklistArea[]> = {};
  for (const [day, dayDraftAreas] of Object.entries(dayDraft)) {
    const built = buildAreas(dayDraftAreas);
    if (built.length > 0) dayAreas[day] = built;
  }
  if (Object.keys(dayAreas).length === 0) {
    return { error: "Select a day and add at least one main area with a name." };
  }

  const schedule = parseVisitSchedule(formData);

  const supabase = await createClient();
  const values = { company_id: companyId, site_id: siteId, areas: [], day_areas: dayAreas, special_note: specialNote, ...schedule };
  const { data, error } = templateId
    ? await supabase.from("checklist_templates").update(values).eq("id", templateId).select("id").single()
    : await supabase.from("checklist_templates").insert(values).select("id").single();

  if (error) return { error: error.message };

  await refreshTodaysCopies(supabase, data.id as string);
  revalidatePath("/checklists");
  revalidatePath("/companies");
  return { success: true, id: data.id as string };
}

export async function deleteTemplateAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("checklist_templates").delete().eq("id", id);
  revalidatePath("/checklists");
}

/** Stops a checklist immediately — strips today-and-future dates from visit_dates, so generate_due_checklists() has nothing left to fire on. Past dates (and the checklists already generated from them) are left untouched. */
export async function endTemplateAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  const { data: template } = await supabase.from("checklist_templates").select("*").eq("id", id).maybeSingle();
  if (!template) return;

  const today = todayInBusinessTimezone();
  if ((template as { cycle_start?: string | null }).cycle_start) {
    // A cycle template stops after today: today's checklists (already sent) stay.
    await supabase.from("checklist_templates").update({ cycle_end: today }).eq("id", id);
  } else {
    const pastDates = ((template.visit_dates as string[] | null) ?? []).filter((d) => d < today);
    await supabase.from("checklist_templates").update({ visit_dates: pastDates }).eq("id", id);
  }
  revalidatePath("/checklists");
  revalidatePath("/companies");
}

/**
 * Standing assignment — links an employee to a template. From then on, the
 * `checklists` instance for each of the template's listed visit_dates is
 * auto-created by the scheduled generate_due_checklists() function right
 * after midnight on that date. But an admin assigning someone expects it to
 * show up for the employee right away, not wait for that schedule — so this
 * also sends today's instance immediately if today is one of the picked
 * dates.
 */
export async function createAssignmentAction(
  _prev: ChecklistFormState,
  formData: FormData
): Promise<ChecklistFormState> {
  const templateId = String(formData.get("templateId") ?? "");
  const companyId = String(formData.get("companyId") ?? "");
  const adminNote = String(formData.get("adminNote") ?? "").trim() || null;
  const employeeIds = formData.getAll("employeeIds").map(String);

  if (!templateId || !companyId || employeeIds.length === 0) {
    return { error: "Company, template and at least one employee are required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("checklist_assignments").upsert(
    employeeIds.map((employee_id) => ({
      template_id: templateId,
      company_id: companyId,
      employee_id,
      admin_note: adminNote,
    })),
    { onConflict: "template_id,employee_id" }
  );

  if (error) return { error: error.message };

  // Send it now: the employee gets today's checklist straight away.
  const result = await sendToday(supabase, templateId, companyId, employeeIds, adminNote);

  revalidatePath("/checklists");
  return { success: true, message: sendMessage(result) };
}

export async function deleteAssignmentAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("checklist_assignments").delete().eq("id", id);
  revalidatePath("/checklists");
}
