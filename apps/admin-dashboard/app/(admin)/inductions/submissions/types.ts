import type { InductionCertificate, InductionSubmissionStatus } from "@macro/shared/types";

export interface SubmissionRow {
  id: string;
  tokenId: string;
  employeeName: string;
  companyName: string;
  siteName: string;
  assignmentName: string;
  submittedAt: string | null;
  status: InductionSubmissionStatus;
  certificate: InductionCertificate | null;
}

/** The 5 statuses from the spec — rejected and an expired certificate both override whatever the raw submission.status says, since neither should ever read as a plain "Completed". */
export type EffectiveSubmissionStatus = "completed" | "pending_approval" | "approved" | "rejected" | "expired";

export function effectiveSubmissionStatus(row: SubmissionRow): EffectiveSubmissionStatus {
  if (row.status === "rejected") return "rejected";
  const certExpired = row.certificate ? new Date() > new Date(row.certificate.expires_at) || row.certificate.status === "expired" : false;
  if (row.status === "expired" || certExpired) return "expired";
  if (row.status === "approved") return "approved";
  if (row.status === "pending_approval") return "pending_approval";
  return "completed";
}

export type ExpiryFilter = "all" | "valid" | "expiring_soon" | "expired";

export function expiryBucket(row: SubmissionRow): ExpiryFilter {
  if (!row.certificate) return "all";
  const expired = new Date() > new Date(row.certificate.expires_at) || row.certificate.status === "expired";
  if (expired) return "expired";
  const daysLeft = (new Date(row.certificate.expires_at).getTime() - Date.now()) / 86_400_000;
  if (daysLeft <= 30) return "expiring_soon";
  return "valid";
}
