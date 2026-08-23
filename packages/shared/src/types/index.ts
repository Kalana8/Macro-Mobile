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
  clock_out_lat: number | null;
  clock_out_lng: number | null;
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
