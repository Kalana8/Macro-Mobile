-- Forces a password change on an employee's first login to the app —
-- the admin sets an initial password when provisioning the login
-- (see apps/admin-dashboard/app/(admin)/employees/actions.ts), and the
-- employee must set their own on first sign-in before using anything else.
alter table employees add column must_change_password boolean not null default true;
