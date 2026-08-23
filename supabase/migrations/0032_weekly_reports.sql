-- Weekly Action Report module (Auditors/Supervisors) — see the
-- "Weekly Action Report module" plan. Unlike audits/checklists this is
-- fully normalized (real tables, not jsonb blobs) because photo annotations
-- must remain independently editable — see report_photo_annotations below.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type weekly_report_status as enum ('draft', 'in_progress', 'completed', 'pdf_generated', 'sent');
create type report_photo_category as enum ('before', 'after', 'additional');
create type report_share_channel as enum ('whatsapp', 'email');
create type report_share_status as enum ('sent', 'failed');

-- ---------------------------------------------------------------------------
-- weekly_reports
-- ---------------------------------------------------------------------------
create sequence weekly_report_number_seq;

create table weekly_reports (
  id uuid primary key default gen_random_uuid(),
  report_number text not null unique default (
    'WAR-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('weekly_report_number_seq')::text, 4, '0')
  ),
  title text not null default '',
  week_start date not null,
  week_ending date not null,
  company_id uuid not null references companies(id) on delete cascade,
  site_id uuid references sites(id) on delete set null,
  location text not null default '',
  auditor_id uuid references employees(id) on delete set null,
  supervisor_id uuid references employees(id) on delete set null,
  report_date date not null default current_date,
  status weekly_report_status not null default 'draft',
  created_by uuid not null references employees(id) on delete cascade,
  updated_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index weekly_reports_company_id_idx on weekly_reports(company_id);
create index weekly_reports_status_idx on weekly_reports(status);
create index weekly_reports_auditor_id_idx on weekly_reports(auditor_id);
create index weekly_reports_supervisor_id_idx on weekly_reports(supervisor_id);
create index weekly_reports_created_by_idx on weekly_reports(created_by);

-- ---------------------------------------------------------------------------
-- report_sections — notes fields (observation/required_improvement/
-- action_taken/additional_notes) live here as columns rather than a separate
-- table: they're four scalar fields with no independent lifecycle.
-- ---------------------------------------------------------------------------
create table report_sections (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references weekly_reports(id) on delete cascade,
  sort_order integer not null default 0,
  title text not null default '',
  area_location text not null default '',
  observation text not null default '',
  required_improvement text not null default '',
  action_taken text not null default '',
  additional_notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index report_sections_report_id_idx on report_sections(report_id);

-- ---------------------------------------------------------------------------
-- report_photos — belongs to a section; before/after/additional.
-- ---------------------------------------------------------------------------
create table report_photos (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references report_sections(id) on delete cascade,
  category report_photo_category not null default 'additional',
  original_url text not null,
  sort_order integer not null default 0,
  uploaded_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now()
);
create index report_photos_section_id_idx on report_photos(section_id);

-- ---------------------------------------------------------------------------
-- report_photo_annotations — one evolving, re-editable annotation set per
-- photo. shapes_json is a Fabric.js canvas.toJSON() dump (source of truth
-- for re-editing); annotated_image_url is a cached rasterized PNG so
-- preview/PDF don't need to re-render Fabric server-side. The original
-- photo (report_photos.original_url) is never overwritten.
-- ---------------------------------------------------------------------------
create table report_photo_annotations (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null unique references report_photos(id) on delete cascade,
  shapes_json jsonb not null default '{}'::jsonb,
  annotated_image_url text,
  updated_by uuid references employees(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- report_pdfs — versioned generated PDFs, stored via ImageKit.
-- ---------------------------------------------------------------------------
create table report_pdfs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references weekly_reports(id) on delete cascade,
  version integer not null default 1,
  file_url text not null,
  generated_by uuid references employees(id) on delete set null,
  generated_at timestamptz not null default now()
);
create index report_pdfs_report_id_idx on report_pdfs(report_id);

-- ---------------------------------------------------------------------------
-- report_shares — WhatsApp/email sharing history.
-- ---------------------------------------------------------------------------
create table report_shares (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references weekly_reports(id) on delete cascade,
  pdf_id uuid references report_pdfs(id) on delete set null,
  channel report_share_channel not null,
  recipient text not null,
  cc text,
  subject text,
  message text,
  status report_share_status not null,
  error_message text,
  sent_by uuid references employees(id) on delete set null,
  sent_at timestamptz not null default now()
);
create index report_shares_report_id_idx on report_shares(report_id);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
create or replace function can_access_weekly_report(target_report_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select true
       from weekly_reports r
      where r.id = target_report_id
        and r.company_id in (select user_company_ids())
        and (r.created_by = auth.uid() or r.auditor_id = auth.uid() or r.supervisor_id = auth.uid())),
    false
  );
$$;

alter table weekly_reports enable row level security;
alter table report_sections enable row level security;
alter table report_photos enable row level security;
alter table report_photo_annotations enable row level security;
alter table report_pdfs enable row level security;
alter table report_shares enable row level security;

create policy weekly_reports_admin_all on weekly_reports for all to authenticated
  using (is_admin()) with check (is_admin());
create policy weekly_reports_participant_select on weekly_reports for select to authenticated
  using (
    company_id in (select user_company_ids())
    and (created_by = auth.uid() or auditor_id = auth.uid() or supervisor_id = auth.uid())
  );
create policy weekly_reports_participant_insert on weekly_reports for insert to authenticated
  with check (created_by = auth.uid() and company_id in (select user_company_ids()));
create policy weekly_reports_participant_update on weekly_reports for update to authenticated
  using (
    company_id in (select user_company_ids())
    and (created_by = auth.uid() or auditor_id = auth.uid() or supervisor_id = auth.uid())
  )
  with check (
    company_id in (select user_company_ids())
    and (created_by = auth.uid() or auditor_id = auth.uid() or supervisor_id = auth.uid())
  );
create policy weekly_reports_creator_delete on weekly_reports for delete to authenticated
  using (created_by = auth.uid());

create policy report_sections_admin_all on report_sections for all to authenticated
  using (is_admin()) with check (is_admin());
create policy report_sections_participant_all on report_sections for all to authenticated
  using (can_access_weekly_report(report_id)) with check (can_access_weekly_report(report_id));

create policy report_photos_admin_all on report_photos for all to authenticated
  using (is_admin()) with check (is_admin());
create policy report_photos_participant_all on report_photos for all to authenticated
  using (can_access_weekly_report((select report_id from report_sections where id = section_id)))
  with check (can_access_weekly_report((select report_id from report_sections where id = section_id)));

create policy report_photo_annotations_admin_all on report_photo_annotations for all to authenticated
  using (is_admin()) with check (is_admin());
create policy report_photo_annotations_participant_all on report_photo_annotations for all to authenticated
  using (can_access_weekly_report((
    select s.report_id from report_photos p join report_sections s on s.id = p.section_id where p.id = photo_id
  )))
  with check (can_access_weekly_report((
    select s.report_id from report_photos p join report_sections s on s.id = p.section_id where p.id = photo_id
  )));

create policy report_pdfs_admin_all on report_pdfs for all to authenticated
  using (is_admin()) with check (is_admin());
create policy report_pdfs_participant_all on report_pdfs for all to authenticated
  using (can_access_weekly_report(report_id)) with check (can_access_weekly_report(report_id));

create policy report_shares_admin_all on report_shares for all to authenticated
  using (is_admin()) with check (is_admin());
create policy report_shares_participant_all on report_shares for all to authenticated
  using (can_access_weekly_report(report_id)) with check (can_access_weekly_report(report_id));

-- ---------------------------------------------------------------------------
-- Permissions — grant the new "weeklyReports" dashboard permission to the
-- existing seeded Admin/Supervisor roles, and seed a new editable Auditor
-- role, so the module works immediately without manual Roles & Access setup.
-- Existing custom roles are left untouched (they default to no access,
-- same as any other new permission — admins can grant it via Roles & Access).
-- ---------------------------------------------------------------------------
update roles
set permissions = jsonb_set(
  permissions,
  '{dashboard,weeklyReports}',
  '{"view": true, "create": true, "edit": true, "delete": true, "generatePdf": true, "share": true}'::jsonb
)
where name in ('Admin', 'Supervisor');

insert into roles (name, is_system, is_admin, permissions)
select
  'Auditor',
  false,
  false,
  '{
    "dashboard": {
      "dashboard": { "view": false },
      "companies": { "view": false, "create": false, "edit": false, "delete": false, "assignEmployees": false },
      "employees": { "view": false, "create": false, "assignAccessRole": false },
      "attendance": { "view": false },
      "audits": { "view": true, "createEdit": true, "delete": false, "enterMarks": false, "sendResults": false },
      "checklists": { "view": false, "create": false, "assign": false, "delete": false },
      "communication": { "view": false, "respond": false },
      "roles": { "view": false, "manage": false },
      "weeklyReports": { "view": true, "create": true, "edit": true, "delete": false, "generatePdf": true, "share": true }
    },
    "app": {
      "home": { "view": false },
      "attendance": { "clockInOut": false, "viewHistory": false },
      "checklists": { "view": false, "submit": false, "imagesOnly": false, "reviewAll": false },
      "audits": { "view": false },
      "communication": { "view": false, "send": false },
      "profile": { "view": false, "changePassword": false }
    }
  }'::jsonb
where not exists (select 1 from roles where name = 'Auditor');
