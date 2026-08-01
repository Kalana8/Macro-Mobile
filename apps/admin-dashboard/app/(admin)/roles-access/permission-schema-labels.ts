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
] as const;

export const APP_SCHEMA = [
  { key: "home", label: "Home", functions: [{ key: "view", label: "View sites" }] },
  {
    key: "attendance",
    label: "Attendance",
    functions: [
      { key: "clockInOut", label: "Clock in/out" },
      { key: "viewHistory", label: "View history" },
    ],
  },
  {
    key: "checklists",
    label: "Checklists",
    functions: [
      { key: "view", label: "View assigned" },
      { key: "submit", label: "Submit" },
      { key: "imagesOnly", label: "View images only (no subtasks/notes)" },
      { key: "reviewAll", label: "View all company submissions (supervisor)" },
    ],
  },
  { key: "audits", label: "Audits", functions: [{ key: "view", label: "View assigned" }] },
  {
    key: "communication",
    label: "Communication",
    functions: [
      { key: "view", label: "View" },
      { key: "send", label: "Send messages" },
    ],
  },
  {
    key: "profile",
    label: "Profile",
    functions: [
      { key: "view", label: "View" },
      { key: "changePassword", label: "Change password" },
    ],
  },
] as const;
