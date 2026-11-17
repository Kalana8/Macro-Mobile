"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@macro/shared/supabase/server";
import { getCurrentAdmin } from "@/lib/session";
import { addDuration, generateRawToken, hashToken, requestOrigin } from "@/lib/inductionToken";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

/**
 * Inserts an invitation, recording the dashboard address so the employee app
 * can open it (0054). Before that migration the column doesn't exist, so it
 * retries without it.
 */
async function insertToken(supabase: Awaited<ReturnType<typeof createClient>>, row: Record<string, unknown>) {
  const link_base_url = await requestOrigin();
  const first = await supabase.from("induction_tokens").insert({ ...row, link_base_url }).select("id").single();
  if (first.error && /link_base_url/.test(first.error.message)) {
    return supabase.from("induction_tokens").insert(row).select("id").single();
  }
  return first;
}

async function requireEmployeeId(): Promise<string> {
  const admin = await getCurrentAdmin();
  if (!admin?.employee) throw new Error("Not signed in.");
  return admin.employee.id;
}

// ---------------------------------------------------------------------------
// Create invitation
// ---------------------------------------------------------------------------

export interface CreateInductionResult extends ActionResult {
  rawToken?: string;
}

export interface SiteInductionResult extends ActionResult {
  /** A link for each employee it was sent to, to pass on outside the app if needed. */
  links?: { name: string; rawToken: string }[];
  /** Employees who already had this induction for the site. */
  skipped?: string[];
  /** Whether employees added to the company later get it too. */
  automatic?: boolean;
}

const EXPIRY_DAYS: Record<string, number> = { "24h": 1, "48h": 2, "3d": 3, "7d": 7, "14d": 14, "30d": 30 };

function expiryFrom(option: string, custom: string, now: Date): { expiresAt?: Date; error?: string } {
  switch (option) {
    case "24h": return { expiresAt: addDuration(now, 24, "hours") };
    case "48h": return { expiresAt: addDuration(now, 48, "hours") };
    case "3d": return { expiresAt: addDuration(now, 3, "days") };
    case "14d": return { expiresAt: addDuration(now, 14, "days") };
    case "30d": return { expiresAt: addDuration(now, 30, "days") };
    case "custom": {
      if (!custom) return { error: "Pick a custom expiration date/time." };
      const d = new Date(custom);
      if (Number.isNaN(d.getTime()) || d <= now) return { error: "Custom expiration must be a valid date/time in the future." };
      return { expiresAt: d };
    }
    default: return { expiresAt: addDuration(now, 7, "days") };
  }
}

/**
 * Adds an induction to a site, like a check: it goes to everyone who works at
 * the site (each sees it in the app under Profile and on Home), and is
 * recorded so anyone added to the site later gets it automatically
 * (site_inductions + the employee_sites trigger, migrations 0056 and 0062).
 */
export async function createSiteInductionAction(_prev: SiteInductionResult, formData: FormData): Promise<SiteInductionResult> {
  const companyId = String(formData.get("companyId") ?? "");
  const siteId = String(formData.get("siteId") ?? "");
  const templateId = String(formData.get("templateId") ?? "") || null;
  const expiryOption = String(formData.get("expiryOption") ?? "7d");
  const customExpiresAt = String(formData.get("customExpiresAt") ?? "");
  // Always automatic: new employees at the site get it too.
  const automatic = true;

  if (!companyId || !siteId) return { error: "Select a company and a site." };
  if (!templateId) return { error: "Select an induction template — create one first if none exist yet." };

  const now = new Date();
  const { expiresAt, error: expiryError } = expiryFrom(expiryOption, customExpiresAt, now);
  if (!expiresAt) return { error: expiryError };

  const performedBy = await requireEmployeeId();
  const supabase = await createClient();

  // Only the site's own company's employees.
  const [{ data: site }, { data: members }, { data: siteLinks, error: siteLinksError }] = await Promise.all([
    supabase.from("sites").select("id, company_id").eq("id", siteId).maybeSingle(),
    supabase.from("employee_companies").select("employee_id, employees(full_name, status)").eq("company_id", companyId),
    supabase.from("employee_sites").select("employee_id").eq("site_id", siteId),
  ]);
  if (!site || site.company_id !== companyId) return { error: "That site isn't part of the selected company." };
  const nameOf = new Map(
    (members ?? []).flatMap((m) => {
      const e = (Array.isArray(m.employees) ? m.employees[0] : m.employees) as { full_name?: string; status?: string } | null;
      if (e?.status && e.status !== "active") return [];
      return [[m.employee_id as string, e?.full_name ?? "Employee"] as const];
    }),
  );
  // Everyone who works at the site (before migration 0062: everyone in the company).
  const atSite = siteLinksError ? [...nameOf.keys()] : (siteLinks ?? []).map((l) => l.employee_id as string);
  const targets = [...new Set(atSite)].filter((id) => nameOf.has(id));

  // Skip anyone who already has it for this site: live or completed.
  const { data: existing } = targets.length
    ? await supabase
        .from("induction_tokens")
        .select("employee_id, status, expires_at")
        .eq("site_id", siteId)
        .eq("template_id", templateId)
        .in("employee_id", targets)
    : { data: [] };
  const has = new Set(
    (existing ?? [])
      .filter((t) => t.status === "completed" || (t.status === "active" && new Date(t.expires_at) > now))
      .map((t) => t.employee_id as string),
  );

  const links: { name: string; rawToken: string }[] = [];
  const skipped: string[] = [];
  for (const employeeId of targets) {
    if (has.has(employeeId)) {
      skipped.push(nameOf.get(employeeId)!);
      continue;
    }
    const rawToken = generateRawToken();
    const { data: token, error } = await insertToken(supabase, {
      employee_id: employeeId,
      site_id: siteId,
      template_id: templateId,
      token_hash: hashToken(rawToken),
      expires_at: expiresAt.toISOString(),
      created_by: performedBy,
    });
    if (error || !token) return { error: error?.message ?? "Couldn't create the invitations.", links, skipped };
    await supabase.from("induction_token_history").insert({
      token_id: token.id,
      action: "created",
      new_expires_at: expiresAt.toISOString(),
      performed_by: performedBy,
    });
    links.push({ name: nameOf.get(employeeId)!, rawToken });
  }

  if (automatic) {
    const expiry_days = EXPIRY_DAYS[expiryOption] ?? Math.max(1, Math.min(90, Math.ceil((expiresAt.getTime() - now.getTime()) / 86_400_000)));
    const { error } = await supabase.from("site_inductions").upsert(
      { site_id: siteId, template_id: templateId, expiry_days, active: true, link_base_url: await requestOrigin(), created_by: performedBy },
      { onConflict: "site_id,template_id" },
    );
    if (error) {
      revalidatePath("/inductions");
      const missing = /site_inductions/.test(error.message);
      return {
        error: missing
          ? "Sent to the selected employees, but sending to new employees automatically needs migration 0056 run first."
          : `Sent to the selected employees, but couldn't turn on automatic sending: ${error.message}`,
        links,
        skipped,
      };
    }
  }

  revalidatePath("/inductions");
  return { success: true, links, skipped, automatic };
}

/** Stops sending a site's induction to new employees. Invitations already sent stay. */
export async function stopSiteInductionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await requireEmployeeId();
  const supabase = await createClient();
  await supabase.from("site_inductions").update({ active: false }).eq("id", id);
  revalidatePath("/inductions");
}

// ---------------------------------------------------------------------------
// Extend expiration
// ---------------------------------------------------------------------------

export async function extendInductionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const tokenId = String(formData.get("tokenId") ?? "");
  const extendOption = String(formData.get("extendOption") ?? "");
  const customExpiresAt = String(formData.get("customExpiresAt") ?? "");
  if (!tokenId) return { error: "Missing invitation." };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("induction_tokens")
    .select("id, expires_at, status")
    .eq("id", tokenId)
    .maybeSingle();
  if (fetchError || !existing) return { error: "Invitation not found." };

  // Extending resets from now, not from the old expiry — an already-expired
  // link being extended should become valid for a fresh window starting now,
  // not silently still-expired because the base was in the past.
  const base = new Date();
  let newExpiresAt: Date;
  switch (extendOption) {
    case "24h": newExpiresAt = addDuration(base, 24, "hours"); break;
    case "3d": newExpiresAt = addDuration(base, 3, "days"); break;
    case "30d": newExpiresAt = addDuration(base, 30, "days"); break;
    case "custom": {
      if (!customExpiresAt) return { error: "Pick a custom expiration date/time." };
      newExpiresAt = new Date(customExpiresAt);
      if (Number.isNaN(newExpiresAt.getTime()) || newExpiresAt <= base) {
        return { error: "Custom expiration must be a valid date/time in the future." };
      }
      break;
    }
    case "7d":
    default:
      newExpiresAt = addDuration(base, 7, "days");
  }

  const performedBy = await requireEmployeeId();
  const { error } = await supabase
    .from("induction_tokens")
    .update({ expires_at: newExpiresAt.toISOString(), status: "active" })
    .eq("id", tokenId);
  if (error) return { error: error.message };

  await supabase.from("induction_token_history").insert({
    token_id: tokenId,
    action: "extended",
    old_expires_at: existing.expires_at,
    new_expires_at: newExpiresAt.toISOString(),
    performed_by: performedBy,
  });

  revalidatePath("/inductions");
  return { success: true };
}

// ---------------------------------------------------------------------------
// Regenerate link — revokes the old token, creates a brand new one.
// ---------------------------------------------------------------------------

export async function regenerateInductionAction(_prev: CreateInductionResult, formData: FormData): Promise<CreateInductionResult> {
  const tokenId = String(formData.get("tokenId") ?? "");
  if (!tokenId) return { error: "Missing invitation." };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("induction_tokens")
    .select("id, employee_id, site_id, template_id, expires_at")
    .eq("id", tokenId)
    .maybeSingle();
  if (fetchError || !existing) return { error: "Invitation not found." };

  const performedBy = await requireEmployeeId();

  const { error: revokeError } = await supabase
    .from("induction_tokens")
    .update({ status: "revoked" })
    .eq("id", tokenId);
  if (revokeError) return { error: revokeError.message };

  await supabase.from("induction_token_history").insert({
    token_id: tokenId,
    action: "regenerated",
    old_expires_at: existing.expires_at,
    performed_by: performedBy,
    note: "Replaced by a newly generated link.",
  });

  const rawToken = generateRawToken();
  const expiresAt = addDuration(new Date(), 7, "days");
  const { data: newToken, error: createError } = await insertToken(supabase, {
    employee_id: existing.employee_id,
    site_id: existing.site_id,
    template_id: existing.template_id,
    token_hash: hashToken(rawToken),
    expires_at: expiresAt.toISOString(),
    created_by: performedBy,
  });
  if (createError || !newToken) return { error: createError?.message ?? "Couldn't generate the new link." };

  await supabase.from("induction_token_history").insert({
    token_id: newToken.id,
    action: "created",
    new_expires_at: expiresAt.toISOString(),
    performed_by: performedBy,
    note: `Regenerated from invitation ${tokenId}.`,
  });

  revalidatePath("/inductions");
  return { success: true, rawToken };
}

export async function revokeInductionAction(formData: FormData): Promise<void> {
  const tokenId = String(formData.get("tokenId") ?? "");
  if (!tokenId) return;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("induction_tokens")
    .select("expires_at")
    .eq("id", tokenId)
    .maybeSingle();

  const performedBy = await requireEmployeeId();
  await supabase.from("induction_tokens").update({ status: "revoked" }).eq("id", tokenId);
  await supabase.from("induction_token_history").insert({
    token_id: tokenId,
    action: "revoked",
    old_expires_at: existing?.expires_at ?? null,
    performed_by: performedBy,
  });

  revalidatePath("/inductions");
}

// ---------------------------------------------------------------------------
// Approve / reject a submitted induction
// ---------------------------------------------------------------------------

export async function approveSubmissionAction(formData: FormData): Promise<void> {
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) return;

  const performedBy = await requireEmployeeId();
  const supabase = await createClient();

  await supabase
    .from("induction_submissions")
    .update({ status: "approved", reviewed_by: performedBy, reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);

  await supabase
    .from("induction_certificates")
    .update({ status: "active" })
    .eq("submission_id", submissionId);

  revalidatePath("/inductions");
  revalidatePath("/inductions/submissions");
}

export async function rejectSubmissionAction(formData: FormData): Promise<void> {
  const submissionId = String(formData.get("submissionId") ?? "");
  const reviewNote = String(formData.get("reviewNote") ?? "").trim() || null;
  if (!submissionId) return;

  const performedBy = await requireEmployeeId();
  const supabase = await createClient();

  await supabase
    .from("induction_submissions")
    .update({ status: "rejected", reviewed_by: performedBy, reviewed_at: new Date().toISOString(), review_note: reviewNote })
    .eq("id", submissionId);

  await supabase
    .from("induction_certificates")
    .update({ status: "revoked" })
    .eq("submission_id", submissionId);

  revalidatePath("/inductions");
  revalidatePath("/inductions/submissions");
}

/** Explicit admin override — marks a submission/certificate expired ahead of the automatic date-based check, e.g. a site policy change that invalidates an otherwise still-valid certificate early. */
export async function markSubmissionExpiredAction(formData: FormData): Promise<void> {
  const submissionId = String(formData.get("submissionId") ?? "");
  if (!submissionId) return;

  const performedBy = await requireEmployeeId();
  const supabase = await createClient();

  await supabase
    .from("induction_submissions")
    .update({ status: "expired", reviewed_by: performedBy, reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);

  await supabase.from("induction_certificates").update({ status: "expired" }).eq("submission_id", submissionId);

  revalidatePath("/inductions");
  revalidatePath("/inductions/submissions");
}

/** Row-level action on the Certificates page — revoke an otherwise-valid certificate, or reactivate a mistakenly revoked one. Does not touch the underlying submission's pass/fail record. */
export async function setCertificateStatusAction(formData: FormData): Promise<void> {
  const certificateId = String(formData.get("certificateId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!certificateId || (status !== "active" && status !== "revoked" && status !== "expired")) return;

  await requireEmployeeId();
  const supabase = await createClient();
  await supabase.from("induction_certificates").update({ status }).eq("id", certificateId);

  revalidatePath("/inductions/certificates");
  revalidatePath("/inductions/submissions");
}

/** Requests a fresh submission from the employee — clears the completed submission's answers status back to nothing usable and revokes the token so a brand-new invitation is needed; used when an admin needs the employee to redo an induction (e.g. content changed materially). */
export async function requestResubmissionAction(formData: FormData): Promise<void> {
  const tokenId = String(formData.get("tokenId") ?? "");
  if (!tokenId) return;

  const performedBy = await requireEmployeeId();
  const supabase = await createClient();

  await supabase.from("induction_tokens").update({ status: "revoked" }).eq("id", tokenId);
  await supabase.from("induction_token_history").insert({
    token_id: tokenId,
    action: "revoked",
    performed_by: performedBy,
    note: "Resubmission requested by admin — employee must complete a new invitation.",
  });

  revalidatePath("/inductions");
  revalidatePath("/inductions/submissions");
}
