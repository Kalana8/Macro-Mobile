-- Macro schema — see "Architecture Document.dc.html" §5 (Data Model) and the
-- extracted prototype data-model notes in the implementation plan.
-- All nested/repeatable shapes (audit main/sub items, checklist areas,
-- permissions) are stored as jsonb to match the Architecture Doc's own
-- "main_audits[], sub_audits[]" shorthand rather than fully normalizing.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type audit_status as enum ('submit', 'verify', 'complete');
create type audit_priority as enum ('low', 'medium', 'high');
create type checklist_status as enum ('pending', 'submitted');
create type comm_priority as enum ('low', 'medium', 'high');
create type comm_status as enum ('open', 'closed');
create type employee_status as enum ('active', 'on_leave', 'inactive');
create type company_status as enum ('active', 'inactive');
create type site_status as enum ('open', 'closed');
create type attendance_status as enum ('clocked_in', 'on_break', 'complete');

-- ---------------------------------------------------------------------------
-- roles — configurable RBAC (Architecture Doc Appendix C "Configurable roles")
-- ---------------------------------------------------------------------------
create table roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_system boolean not null default false,
  -- shape: { dashboard: {...}, app: {...} } — see packages/shared/src/types RolePermissions
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  status company_status not null default 'active',
  visit_days smallint[] not null default '{}', -- 0=Sun..6=Sat
  visit_time time,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- sites — belongs to a company, carries the geofence coordinates
-- ---------------------------------------------------------------------------
create table sites (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  address text not null,
  lat double precision not null,
  lng double precision not null,
  status site_status not null default 'open',
  created_at timestamptz not null default now()
);
create index sites_company_id_idx on sites(company_id);

-- ---------------------------------------------------------------------------
-- employees — profile row keyed to auth.users(id); credentials live in
-- Supabase Auth, not here.
-- ---------------------------------------------------------------------------
create table employees (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  username text not null unique, -- login email, mirrors auth.users.email
  job_role text not null default '',
  access_role_id uuid not null references roles(id),
  status employee_status not null default 'active',
  phone text,
  department text,
  created_at timestamptz not null default now()
);

create table employee_companies (
  employee_id uuid not null references employees(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  primary key (employee_id, company_id)
);
create index employee_companies_company_id_idx on employee_companies(company_id);

-- ---------------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------------
create table attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  date date not null default current_date,
  clock_in_at timestamptz,
  clock_out_at timestamptz,
  break_started_at timestamptz,
  total_break_minutes integer not null default 0,
  geo_verified boolean not null default false,
  status attendance_status not null default 'clocked_in',
  created_at timestamptz not null default now()
);
create index attendance_employee_id_idx on attendance(employee_id);
create index attendance_company_id_idx on attendance(company_id);
create index attendance_date_idx on attendance(date);

-- ---------------------------------------------------------------------------
-- audits — employee-submitted or admin-created; scored by admin.
-- main_audits shape: [{ id, title, comment, marks, images: [], sub_audits:
--   [{ id, text, result: ''|not_satisfactory|satisfactory|good }] }]
-- ---------------------------------------------------------------------------
create table audits (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  date date not null default current_date,
  status audit_status not null default 'submit',
  title text not null default '',
  description text not null default '',
  priority audit_priority not null default 'medium',
  location text not null default '',
  notes text not null default '',
  images text[] not null default '{}',
  main_audits jsonb not null default '[]'::jsonb,
  final_marks integer,
  max_marks integer not null default 100,
  sent_to uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index audits_company_id_idx on audits(company_id);
create index audits_employee_id_idx on audits(employee_id);
create index audits_status_idx on audits(status);

-- ---------------------------------------------------------------------------
-- checklist_templates / checklists — templates are reusable; checklists are
-- per-employee assigned instances that deep-copy the template's areas at
-- assignment time (not a live reference).
-- areas shape: [{ main_area, note, images: [], subtasks: [{ id, text, done?,
--   comment? }] }]
-- ---------------------------------------------------------------------------
create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  site text not null default '',
  areas jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index checklist_templates_company_id_idx on checklist_templates(company_id);

create table checklists (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references checklist_templates(id) on delete set null,
  company_id uuid not null references companies(id) on delete cascade,
  site text not null default '',
  employee_id uuid not null references employees(id) on delete cascade,
  assigned_date date not null default current_date,
  areas jsonb not null default '[]'::jsonb,
  status checklist_status not null default 'pending',
  notes text,
  admin_note text,
  images text[] not null default '{}',
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
create index checklists_company_id_idx on checklists(company_id);
create index checklists_employee_id_idx on checklists(employee_id);

-- ---------------------------------------------------------------------------
-- communications — issue/ticket-style company chat log (Firebase handles the
-- live message transport; this table is the durable Postgres record of each
-- thread's metadata for admin/dashboard listing + RLS-scoped access).
-- ---------------------------------------------------------------------------
create table communications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  title text not null,
  priority comm_priority not null default 'medium',
  status comm_status not null default 'open',
  last_update text not null default '',
  created_at timestamptz not null default now()
);
create index communications_company_id_idx on communications(company_id);

-- ---------------------------------------------------------------------------
-- Storage buckets — private, served via short-lived signed URLs
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('audit-images', 'audit-images', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('checklist-images', 'checklist-images', false)
on conflict (id) do nothing;
