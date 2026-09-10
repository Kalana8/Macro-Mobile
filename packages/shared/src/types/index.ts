// Hand-written types mirroring supabase/migrations/0001_init.sql.
// Regenerate/replace with `supabase gen types typescript` once a real project exists.

export type AuditStatus = "submit" | "verify" | "complete";
export type AuditRating = "" | "not_satisfactory" | "satisfactory" | "good";
export type ChecklistStatus = "pending" | "submitted";
export type CommPriority = "low" | "medium" | "high";
export type CommStatus = "open" | "closed";
export type EmployeeStatus = "active" | "on_leave" | "inactive";
export type CompanyStatus = "active" | "inactive";

export interface Company {
  id: string;
  name: string;
  location: string | null;
  logo: string | null;
  status: CompanyStatus;
  created_at: string;
}

export interface Site {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  status: "open" | "closed";
  /** Geofence radius, in meters, for site-login/clock-in/clock-out location checks. Defaults to 20. */
  allowed_radius: number;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  is_system: boolean;
  is_admin: boolean;
  permissions: RolePermissions;
  created_at: string;
}

export interface Employee {
  id: string; // = auth.users.id
  full_name: string;
  username: string; // login email
  job_role: string;
  access_role_id: string;
  status: EmployeeStatus;
  phone: string | null;
  department: string | null;
  must_change_password: boolean;
  created_at: string;
}

export interface EmployeeCompany {
  employee_id: string;
  company_id: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  company_id: string;
  site_id: string;
  date: string; // YYYY-MM-DD
  clock_in_at: string | null;
  clock_out_at: string | null;
  break_started_at: string | null;
  total_break_minutes: number;
  geo_verified: boolean;
  clock_in_lat: number | null;
  clock_in_lng: number | null;
  clock_in_address: string | null;
  clock_in_distance: number | null;
  clock_out_lat: number | null;
  clock_out_lng: number | null;
  clock_out_address: string | null;
  clock_out_distance: number | null;
  clock_out_geo_verified: boolean;
  status: "clocked_in" | "on_break" | "complete";
  created_at: string;
}

export interface AuditSubItem {
  id: string;
  text: string;
  result: AuditRating;
}

export interface AuditMainItem {
  id: string;
  title: string;
  comment: string;
  marks: number | null;
  images: string[];
  sub_audits: AuditSubItem[];
}

export interface Audit {
  id: string;
  company_id: string;
  employee_id: string;
  date: string;
  status: AuditStatus;
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  location: string;
  notes: string;
  images: string[];
  main_audits: AuditMainItem[];
  final_marks: number | null;
  max_marks: number;
  sent_to: string[];
  created_at: string;
}

export interface ChecklistSubtask {
  id: string;
  text: string;
  done?: boolean;
  comment?: string;
}

export interface ChecklistArea {
  main_area: string;
  note: string;
  images: string[];
  subtasks: ChecklistSubtask[];
}

export interface ChecklistTemplate {
  id: string;
  company_id: string;
  site_id: string;
  // Legacy fallback content — day_areas is the source of truth now; this is
  // only read if a selected day somehow has no entry there.
  areas: ChecklistArea[];
  // Content keyed by day-of-week string ("0"=Sun..."6"=Sat) — every picked
  // date in visit_dates that falls on a given weekday automatically reuses
  // that weekday's entry here.
  day_areas: Record<string, ChecklistArea[]>;
  // One-off instruction sent alongside the checklist — separate from each
  // area's own note; shown to the employee as a highlighted "Specific Task"
  // callout.
  special_note: string | null;
  // Exact calendar dates this checklist is scheduled on, picked individually
  // from the 4-week grid. "End Now" strips today-and-future dates, leaving
  // past dates untouched.
  visit_dates: string[]; // "YYYY-MM-DD"
  created_at: string;
}

export interface Checklist {
  id: string;
  template_id: string;
  company_id: string;
  site: string;
  site_id: string | null;
  employee_id: string;
  assigned_date: string;
  areas: ChecklistArea[];
  special_note: string | null;
  status: ChecklistStatus;
  notes: string | null;
  admin_note: string | null;
  images: string[];
  submitted_at: string | null;
  created_at: string;
}

export interface ChecklistAssignment {
  id: string;
  template_id: string;
  company_id: string;
  employee_id: string;
  admin_note: string | null;
  created_at: string;
}

// ---- Weekly Action Report ----
export type WeeklyReportStatus = "draft" | "in_progress" | "completed" | "pdf_generated" | "sent";
export type ReportShareChannel = "whatsapp" | "email";
export type ReportShareStatus = "sent" | "failed";

export interface WeeklyReport {
  id: string;
  report_number: string;
  title: string;
  week_start: string;
  week_ending: string;
  company_id: string;
  site_id: string | null;
  location: string;
  auditor_id: string | null;
  supervisor_id: string | null;
  report_date: string;
  status: WeeklyReportStatus;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportSection {
  id: string;
  report_id: string;
  sort_order: number;
  title: string;
  area_location: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ReportPhoto {
  id: string;
  section_id: string;
  original_url: string;
  sort_order: number;
  uploaded_by: string | null;
  created_at: string;
}

export interface PhotoAnnotation {
  id: string;
  photo_id: string;
  // Fabric.js canvas.toJSON() output — the source of truth for re-editing.
  shapes_json: Record<string, unknown>;
  annotated_image_url: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface ReportPdf {
  id: string;
  report_id: string;
  version: number;
  file_url: string;
  generated_by: string | null;
  generated_at: string;
}

export interface ReportShare {
  id: string;
  report_id: string;
  pdf_id: string | null;
  channel: ReportShareChannel;
  recipient: string;
  cc: string | null;
  subject: string | null;
  message: string | null;
  status: ReportShareStatus;
  error_message: string | null;
  sent_by: string | null;
  sent_at: string;
}

// ---- Employee Site Induction ----
export type InductionTokenStatus = "active" | "expired" | "revoked" | "completed";
export type InductionSubmissionStatus = "draft" | "completed" | "failed" | "pending_approval" | "approved" | "rejected" | "expired";
export type InductionCertificateStatus = "pending" | "active" | "expired" | "revoked";

export interface InductionToken {
  id: string;
  employee_id: string;
  site_id: string;
  template_id: string | null;
  token_hash: string;
  status: InductionTokenStatus;
  created_by: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  last_accessed_at: string | null;
}

// Google Forms–style dynamic question builder — an induction/assignment is
// Sections, each holding Questions of any of these types. New question
// types can be added here without a database migration, since the whole
// section/question tree is stored as one jsonb column.
export type InductionQuestionType =
  | "short_answer"
  | "paragraph"
  | "multiple_choice"
  | "checkboxes"
  | "dropdown"
  | "yes_no"
  | "true_false"
  | "date"
  | "time"
  | "file_upload"
  | "image_upload"
  | "video_upload";

/** Question types whose answer can be auto-graded against `correctAnswers` — free-text and upload types have no single right answer, so they're never scored even if given `marks`. */
export const GRADABLE_QUESTION_TYPES: InductionQuestionType[] = ["multiple_choice", "checkboxes", "dropdown", "yes_no", "true_false"];

export interface InductionQuestion {
  id: string;
  type: InductionQuestionType;
  title: string;
  description?: string;
  required: boolean;
  /** multiple_choice / checkboxes / dropdown only. */
  options?: string[];
  /** file_upload only — e.g. ".pdf,.docx,.xlsx". */
  acceptedFileTypes?: string;
  /** file_upload / image_upload / video_upload only. */
  maxFileSizeMb?: number;
  /** Assessment grading — only meaningful for GRADABLE_QUESTION_TYPES. One value for single-answer types, multiple for a checkboxes question with more than one correct option. */
  correctAnswers?: string[];
  /** Points this question is worth toward the assessment score. Defaults to 1 when gradable. */
  marks?: number;
  /** Shown after submission alongside the correct answer, when the assignment allows answer review. */
  explanation?: string;
}

export interface InductionFormSection {
  id: string;
  title: string;
  description: string;
  questions: InductionQuestion[];
}

/**
 * One training slide the employee must view (for at least `minSeconds`)
 * before the assessment unlocks. The slide's actual visual design — text
 * boxes, images, shapes, lines, background — is a Fabric.js canvas, stored
 * as its own `canvas.toJSON()` output so the PowerPoint-style editor can
 * reopen and keep editing individual elements later, and the employee-facing
 * presentation renders the exact same canvas read-only. `content`/`imageUrl`
 * are legacy fields from the pre-canvas-editor slide model, kept only so
 * older slides created before this editor still render a sensible fallback.
 */
export interface InductionTrainingSlide {
  id: string;
  title: string;
  /** Minimum seconds the employee must stay on this slide before "Next" enables. */
  minSeconds: number;
  /** Fabric.js Canvas#toJSON() output — objects, background color/image, everything. Null for a slide never opened in the canvas editor. */
  canvasJson: Record<string, unknown> | null;
  /** Optional video shown alongside the canvas — kept as a plain URL field rather than a canvas object, since embedding a live <video> inside a Fabric canvas is unreliable. */
  videoUrl?: string;
  /** @deprecated pre-canvas-editor plain-text content, rendered as a fallback only when canvasJson is empty. */
  content?: string;
  /** @deprecated pre-canvas-editor single image, rendered as a fallback only when canvasJson is empty. */
  imageUrl?: string;
}

export type InductionTemplateStatus = "draft" | "published";

/** Broad classification separate from the free-text `category` — drives default mandatory-ness and admin filtering/reporting. */
export type InductionType = "whs" | "site_specific" | "contractor" | "visitor" | "equipment";

export const INDUCTION_TYPE_LABEL: Record<InductionType, string> = {
  whs: "WHS General Induction",
  site_specific: "Site-Specific Induction",
  contractor: "Contractor Induction",
  visitor: "Visitor Induction",
  equipment: "Equipment / Specialised Induction",
};

export interface InductionTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  induction_type: InductionType;
  /** WHS inductions default to mandatory; other types can be configured either way. */
  is_mandatory: boolean;
  status: InductionTemplateStatus;
  cover_image_url: string | null;
  sections: InductionFormSection[];
  training_slides: InductionTrainingSlide[];
  /** Percentage (0-100) of total marks required to pass the assessment. */
  pass_mark_percent: number;
  /** Null = unlimited retakes. */
  max_attempts: number | null;
  /** Hours an employee must wait after a failed attempt before retaking. 0 = immediately. */
  retake_delay_hours: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  /** Whether a failed attempt shows which questions were wrong and their correct answers. */
  show_correct_answers: boolean;
  certificate_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** One question's answer — a plain value, a set of checked options, or an uploaded file's URL/name. */
export type InductionAnswerValue = string | string[] | { fileUrl: string; fileName: string } | null;

/** Per-question outcome recorded against one assessment attempt — `correct` is null for non-gradable question types (free text, uploads). */
export interface InductionAttemptAnswerResult {
  questionId: string;
  correct: boolean | null;
  marksAwarded: number;
  marksPossible: number;
}

/** One full pass through the assessment — appended to `InductionSubmission.attempts`, never overwritten, so the complete retake history is preserved. */
export interface InductionAttempt {
  attemptNumber: number;
  startedAt: string;
  submittedAt: string;
  answers: Record<string, InductionAnswerValue>;
  results: InductionAttemptAnswerResult[];
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
}

export interface InductionTokenHistory {
  id: string;
  token_id: string;
  action: "created" | "extended" | "regenerated" | "revoked";
  old_expires_at: string | null;
  new_expires_at: string | null;
  performed_by: string | null;
  performed_at: string;
  note: string | null;
}

export interface InductionSubmission {
  id: string;
  token_id: string;
  employee_id: string;
  site_id: string;
  /** The current (in-progress or most recent) attempt's answers — kept for the draft-save flow; the authoritative scored record of each submitted attempt lives in `attempts`. */
  answers: Record<string, InductionAnswerValue>;
  signature_name: string | null;
  status: InductionSubmissionStatus;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  /** Every assessment attempt this employee has made, oldest first — retaking never deletes or overwrites a prior entry. */
  attempts: InductionAttempt[];
  /** slideId -> viewing progress, so reopening mid-training resumes rather than restarting. */
  training_progress: Record<string, { viewed: boolean; timeSpentSeconds: number; completedAt?: string }>;
  training_completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InductionCertificate {
  id: string;
  submission_id: string;
  employee_id: string;
  site_id: string;
  certificate_number: string;
  file_url: string | null;
  status: InductionCertificateStatus;
  issued_at: string;
  expires_at: string;
  created_at: string;
}

export interface Communication {
  id: string;
  company_id: string;
  site_id: string | null;
  title: string;
  priority: CommPriority;
  status: CommStatus;
  last_update: string;
  last_message_at: string | null;
  created_at: string;
}

export interface CommunicationRecipient {
  communication_id: string;
  employee_id: string;
}

// ---- RBAC permission shape (see packages/shared/src/rbac) ----
export interface DashboardPermissions {
  dashboard: { view: boolean };
  companies: { view: boolean; create: boolean; edit: boolean; delete: boolean; assignEmployees: boolean };
  employees: { view: boolean; create: boolean; assignAccessRole: boolean };
  attendance: { view: boolean };
  audits: { view: boolean; createEdit: boolean; delete: boolean; enterMarks: boolean; sendResults: boolean };
  checklists: { view: boolean; create: boolean; assign: boolean; delete: boolean };
  communication: { view: boolean; respond: boolean };
  roles: { view: boolean; manage: boolean };
  weeklyReports: {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
    generatePdf: boolean;
    share: boolean;
  };
  inductions: { view: boolean; create: boolean; manage: boolean; approve: boolean };
}

export interface AppPermissions {
  home: { view: boolean };
  attendance: { clockInOut: boolean; viewHistory: boolean };
  // imagesOnly is a restricted view (e.g. the Client role) — the checklist
  // detail page shows just submitted photos, no subtasks/notes/status.
  // reviewAll (e.g. Supervisor) is the opposite direction — full detail,
  // but for every submission across their company, not just their own.
  checklists: { view: boolean; submit: boolean; imagesOnly: boolean; reviewAll: boolean };
  audits: { view: boolean };
  communication: { view: boolean; send: boolean };
  profile: { view: boolean; changePassword: boolean };
}

export interface RolePermissions {
  dashboard: DashboardPermissions;
  app: AppPermissions;
}
