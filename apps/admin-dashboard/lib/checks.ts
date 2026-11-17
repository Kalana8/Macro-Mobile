/** Documents employees hand in (Police Check, VEVO Check, ...), migration 0057. */

export interface CheckType {
  id: string;
  name: string;
  description: string;
  sort: number;
  active: boolean;
}

export interface EmployeeCheck {
  id: string;
  employee_id: string;
  check_type_id: string;
  status: "submitted" | "approved" | "rejected";
  document_path: string;
  file_name: string;
  note: string;
  expires_on: string | null;
  review_note: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export type CheckState = "missing" | "submitted" | "approved" | "rejected" | "expired";

/** Where one check stands; an approved check past its expiry date needs handing in again. */
export function checkState(c: Pick<EmployeeCheck, "status" | "expires_on"> | undefined, today: string): CheckState {
  if (!c) return "missing";
  if (c.status === "approved" && c.expires_on && c.expires_on < today) return "expired";
  return c.status;
}

export const CHECK_LABEL: Record<CheckState, string> = {
  missing: "Not handed in",
  submitted: "To review",
  approved: "Approved",
  rejected: "Sent back",
  expired: "Expired",
};

export const CHECK_TONE: Record<CheckState, "neutral" | "info" | "warning" | "success" | "error"> = {
  missing: "error",
  submitted: "warning",
  approved: "success",
  rejected: "error",
  expired: "error",
};

/** True when a missing table means migration 0057 hasn't been run. */
export function checksNotSetUp(message: string | undefined): boolean {
  return !!message && /check_types|employee_checks|schema cache|does not exist/i.test(message);
}
