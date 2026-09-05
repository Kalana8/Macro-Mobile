import type { InductionCertificate, InductionSubmission, InductionToken } from "@macro/shared/types";

export interface InductionRow extends InductionToken {
  employeeName: string;
  siteName: string;
  companyName: string;
  submission: InductionSubmission | null;
  certificate: InductionCertificate | null;
}

/** Effective status for display/filtering — factors in "expired but DB row not yet flagged" (status flips lazily on next access, not via a cron), matching how induction/[token] itself decides expiry. */
export type EffectiveStatus = "active" | "expiring_soon" | "expired" | "completed" | "revoked";

export function effectiveStatus(row: InductionToken): EffectiveStatus {
  if (row.status === "revoked") return "revoked";
  if (row.status === "completed") return "completed";
  const expiresAt = new Date(row.expires_at).getTime();
  const now = Date.now();
  if (now > expiresAt) return "expired";
  if (expiresAt - now <= 24 * 3600_000) return "expiring_soon";
  return "active";
}
