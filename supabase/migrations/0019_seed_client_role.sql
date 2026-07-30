-- "Client" role: restricted to the employee app's Communication and
-- Checklists areas only (no admin dashboard access at all). Profile is
-- also enabled so they can still change their password and log out —
-- every role needs that baseline, it's not one of the areas being granted.
insert into roles (name, is_admin, permissions)
values (
  'Client',
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
      "home": { "view": false },
      "attendance": { "clockInOut": false, "viewHistory": false },
      "checklists": { "view": false, "submit": false, "imagesOnly": true },
      "audits": { "view": false },
      "communication": { "view": true, "send": true },
      "profile": { "view": true, "changePassword": true }
    }
  }'::jsonb
)
on conflict (name) do update set permissions = excluded.permissions;
