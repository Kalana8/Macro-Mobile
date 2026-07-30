// Hand-written types mirroring supabase/migrations/0001_init.sql.
// Regenerate/replace with `supabase gen types typescript` once a real project exists.

export type AuditStatus = "submit" | "verify" | "complete";
export type AuditRating = "" | "not_satisfactory" | "satisfactory" | "good";
export type ChecklistStatus = "pending" | "submitted";
export type CommPriority = "low" | "medium" | "high";
export type CommStatus = "open" | "closed";
export type EmployeeStatus = "active" | "on_leave" | "inactive";
export type CompanyStatus = "active" | "inactive";

export type VisitFrequency = "weekly" | "fortnightly" | "custom";

export interface Company {
  id: string;
  name: string;
  location: string | null;
  logo: string | null;
  status: CompanyStatus;
  visit_frequency: VisitFrequency;
  visit_days: number[]; // 0=Sun..6=Sat — used by weekly & fortnightly
  visit_time: string | null; // "HH:MM"
  visit_start_date: string | null; // "YYYY-MM-DD" — fortnightly anchor, or custom range start
  visit_end_date: string | null; // "YYYY-MM-DD" — custom range end
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
  site: string;
  areas: ChecklistArea[];
  created_at: string;
}

export interface Checklist {
  id: string;
  template_id: string;
  company_id: string;
  site: string;
  employee_id: string;
  assigned_date: string;
  areas: ChecklistArea[];
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
}

export interface AppPermissions {
  home: { view: boolean };
  attendance: { clockInOut: boolean; viewHistory: boolean };
  // imagesOnly is a restricted view (e.g. the Client role) — the checklist
  // detail page shows just submitted photos, no subtasks/notes/status.
  checklists: { view: boolean; submit: boolean; imagesOnly: boolean };
  audits: { view: boolean };
  communication: { view: boolean; send: boolean };
  profile: { view: boolean; changePassword: boolean };
}

export interface RolePermissions {
  dashboard: DashboardPermissions;
  app: AppPermissions;
}
