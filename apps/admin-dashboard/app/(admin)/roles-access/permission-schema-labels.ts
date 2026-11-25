// Display labels for the RolePermissions shape (packages/shared/src/types),
// matching the permissionSchema defined in the "Macro Admin Dashboard.dc.html"
// prototype's Component class exactly.

export const DASHBOARD_SCHEMA = [
  { key: "dashboard", label: "Dashboard", functions: [{ key: "view", label: "View overview" }] },
  {
    key: "companies",
    label: "Companies",
    functions: [
      { key: "view", label: "View" },
      { key: "create", label: "Create" },
      { key: "edit", label: "Edit" },
      { key: "delete", label: "Delete" },
      { key: "assignEmployees", label: "Assign employees" },
    ],
  },
  {
    key: "employees",
    label: "Employees",
    functions: [
      { key: "view", label: "View" },
      { key: "create", label: "Create" },
      { key: "assignAccessRole", label: "Assign access role" },
    ],
  },
  { key: "attendance", label: "Attendance", functions: [{ key: "view", label: "View daily/weekly" }] },
  {
    key: "audits",
    label: "Audits",
    functions: [
      { key: "view", label: "View" },
      { key: "createEdit", label: "Create/edit" },
      { key: "delete", label: "Delete" },
      { key: "enterMarks", label: "Enter marks" },
      { key: "sendResults", label: "Send results" },
    ],
  },
  {
    key: "checklists",
    label: "Checklists",
    functions: [
      { key: "view", label: "View" },
      { key: "create", label: "Create templates" },
      { key: "assign", label: "Assign" },
      { key: "delete", label: "Delete" },
    ],
  },
  {
    key: "communication",
    label: "Communication",
    functions: [
      { key: "view", label: "View" },
      { key: "respond", label: "Respond" },
    ],
  },
  {
    key: "roles",
    label: "Roles & Access",
    functions: [
      { key: "view", label: "View" },
      { key: "manage", label: "Create/edit roles" },
    ],
  },
  {
    key: "weeklyReports",
    label: "Weekly Action Report",
    functions: [
      { key: "view", label: "View" },
      { key: "create", label: "Create" },
      { key: "edit", label: "Edit" },
      { key: "delete", label: "Delete" },
      { key: "generatePdf", label: "Generate PDF" },
      { key: "share", label: "Share (WhatsApp/Email)" },
    ],
  },
  {
    key: "inductions",
    label: "Induction and Check Links",
    functions: [
      { key: "view", label: "View" },
      { key: "create", label: "Create invitations" },
      { key: "manage", label: "Extend/regenerate/revoke" },
      { key: "approve", label: "Approve/reject submissions" },
    ],
  },
] as const;

// Matches the pages and features of the employee mobile app.
export const APP_SCHEMA = [
  { key: "home", label: "Home", functions: [{ key: "view", label: "View home (sites, setup reminder, up next)" }] },
  {
    key: "attendance",
    label: "Clock In / Attendance",
    functions: [
      { key: "clockInOut", label: "Clock in/out and breaks" },
      { key: "viewHistory", label: "View attendance history" },
    ],
  },
  {
    key: "checklists",
    label: "Checklists",
    functions: [
      { key: "view", label: "View assigned (today, expired, full checklist)" },
      { key: "submit", label: "Tick off and submit (notes, photos)" },
      { key: "share", label: "Share completed checklists" },
      { key: "reviewAll", label: "Company checklists: full checklist, read only (tasks, ticks, notes, photos)" },
      { key: "imagesOnly", label: "Company checklists: photos only (no tasks or notes)" },
    ],
  },
  {
    key: "audits",
    label: "Audits",
    functions: [
      { key: "view", label: "View audits shared with them" },
      { key: "respond", label: "Verified and submit (note, photos)" },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    functions: [
      { key: "view", label: "View reports shared with them" },
      { key: "respond", label: "Verified and submit (note, photos)" },
    ],
  },
  {
    key: "photos",
    label: "Photos",
    functions: [
      { key: "view", label: "View received photos" },
      { key: "send", label: "Send photos" },
      { key: "download", label: "Download photos" },
    ],
  },
  {
    key: "communication",
    label: "Messages",
    functions: [
      { key: "view", label: "View messages" },
      { key: "send", label: "Start and reply (with photos)" },
    ],
  },
  {
    key: "profile",
    label: "Profile",
    functions: [
      { key: "view", label: "View profile and staff ID" },
      { key: "photo", label: "Change profile photo" },
      { key: "inductions", label: "Complete inductions and checks" },
    ],
  },
] as const;

// Extra push alerts for a role (migration 0074), about the people at the
// sites its members are assigned to. The usual notifications don't change.
export const NOTIFICATION_SCHEMA = [
  { key: "checklistSubmitted", label: "Checklist submitted " },
  { key: "auditSubmitted", label: "Audit submitted (Verified, note and photos)" },
  { key: "reportSubmitted", label: "Weekly report submitted" },
  { key: "photosSent", label: "Photos sent" },
  { key: "clockInOut", label: "Clock in and clock out" },
  { key: "messages", label: "New messages" },
  { key: "attendanceAlerts", label: "Left site while clocked in, or not clocked in on time" },
] as const;
