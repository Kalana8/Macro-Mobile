-- Seed roles matching the permissionSchema extracted from
-- "Macro Admin Dashboard.dc.html" (Roles & Access screen). These three are
-- the defaults referenced in Architecture Document Appendix D; more can be
-- created later from the Roles & Access page.

insert into roles (name, is_system, is_admin, permissions) values
(
  'Admin',
  true,
  true,
  '{
    "dashboard": {
      "dashboard": { "view": true },
      "companies": { "view": true, "create": true, "edit": true, "delete": true, "assignEmployees": true },
      "employees": { "view": true, "create": true, "assignAccessRole": true },
      "attendance": { "view": true },
      "audits": { "view": true, "createEdit": true, "delete": true, "enterMarks": true, "sendResults": true },
      "checklists": { "view": true, "create": true, "assign": true, "delete": true },
      "communication": { "view": true, "respond": true },
      "roles": { "view": true, "manage": true }
    },
    "app": {
      "home": { "view": false },
      "attendance": { "clockInOut": false, "viewHistory": false },
      "checklists": { "view": false, "submit": false },
      "audits": { "view": false },
      "communication": { "view": true, "send": true },
      "profile": { "view": false, "changePassword": false }
    }
  }'::jsonb
),
(
  'Supervisor',
  true,
  false,
  '{
    "dashboard": {
      "dashboard": { "view": false },
      "companies": { "view": false, "create": false, "edit": false, "delete": false, "assignEmployees": false },
      "employees": { "view": false, "create": false, "assignAccessRole": false },
      "attendance": { "view": true },
      "audits": { "view": true, "createEdit": false, "delete": false, "enterMarks": false, "sendResults": false },
      "checklists": { "view": true, "create": false, "assign": false, "delete": false },
      "communication": { "view": true, "respond": true },
      "roles": { "view": false, "manage": false }
    },
    "app": {
      "home": { "view": true },
      "attendance": { "clockInOut": true, "viewHistory": true },
      "checklists": { "view": true, "submit": true },
      "audits": { "view": true },
      "communication": { "view": true, "send": true },
      "profile": { "view": true, "changePassword": true }
    }
  }'::jsonb
),
(
  'Field Employee',
  true,
  false,
  '{
    "dashboard": {
      "dashboard": { "view": false },
      "companies": { "view": false, "create": false, "edit": false, "delete": false, "assignEmployees": false },
      "employees": { "view": false, "create": false, "assignAccessRole": false },
      "attendance": { "view": false },
      "audits": { "view": false, "createEdit": false, "delete": false, "enterMarks": false, "sendResults": false },
      "checklists": { "view": false, "create": false, "assign": false, "delete": false },
      "communication": { "view": false, "respond": false },
      "roles": { "view": false, "manage": false }
    },
    "app": {
      "home": { "view": true },
      "attendance": { "clockInOut": true, "viewHistory": true },
      "checklists": { "view": true, "submit": true },
      "audits": { "view": true },
      "communication": { "view": true, "send": true },
      "profile": { "view": true, "changePassword": true }
    }
  }'::jsonb
);
