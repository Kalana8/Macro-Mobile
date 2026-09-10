import type { InductionCertificate, InductionSubmissionStatus, InductionType } from "@macro/shared/types";

export type TrainingStatus = "not_started" | "in_progress" | "completed";
export type AssessmentStatus = "not_started" | "in_progress" | "failed" | "passed";

export interface SubmissionRow {
  id: string;
  tokenId: string;
  employeeName: string;
  companyName: string;
  siteName: string;
  assignmentName: string;
  inductionType: InductionType;
  submittedAt: string | null;
  status: InductionSubmissionStatus;
  certificate: InductionCertificate | null;
  trainingStatus: TrainingStatus;
  slidesViewed: number;
  slidesTotal: number;
  bestScore: number | null;
  latestScore: number | null;
  attemptsCount: number;
  passMarkPercent: number;
}

/** The status the spec's Submitted Forms table actually cares about — expiry overrides everything else, since an expired certificate is never treated as a valid pass. */
export type EffectiveSubmissionStatus = "not_started" | "in_progress" | "failed" | "passed" | "expired";

export function assessmentStatus(row: SubmissionRow): AssessmentStatus {
  if (row.status === "completed" || row.status === "approved") return "passed";
  if (row.status === "failed" || row.status === "rejected") return "failed";
  if (row.attemptsCount > 0) return "in_progress";
  return "not_started";
}

export function effectiveSubmissionStatus(row: SubmissionRow): EffectiveSubmissionStatus {
  const certExpired = row.certificate ? new Date() > new Date(row.certificate.expires_at) || row.certificate.status === "expired" : false;
  const status = assessmentStatus(row);
  if (status === "passed" && certExpired) return "expired";
  if (row.status === "expired") return "expired";
  return status;
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
