-- Row-Level Security — Architecture Document §4 ("Gate 3 — Row security")
-- and §9 (Security Notes): RLS is the single source of truth for data
-- access, independent of what the UI/role-permission middleware requests.
--
-- Modeling note: `roles.is_admin` is a separate, simpler boolean from the
-- granular `roles.permissions` jsonb used for page-level UI/middleware
-- gating (Appendix C). RLS only needs the coarse "sees everything vs. sees
-- own company/site" boundary — the fine-grained page/function toggles are
-- enforced by Next.js middleware + UI conditional rendering, not by RLS.
alter table roles add column is_admin boolean not null default false;

-- ---------------------------------------------------------------------------
-- Helper functions (SECURITY DEFINER so they can read `employees`/`roles`
-- for the calling user even though RLS on those tables would otherwise
-- block it — the functions only ever return facts about the CALLER).
-- ---------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select r.is_admin
       from employees e
       join roles r on r.id = e.access_role_id
      where e.id = auth.uid()),
    false
  );
$$;

create or replace function user_company_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select company_id from employee_companies where employee_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table roles enable row level security;
alter table companies enable row level security;
alter table sites enable row level security;
alter table employees enable row level security;
alter table employee_companies enable row level security;
alter table attendance enable row level security;
alter table audits enable row level security;
alter table checklist_templates enable row level security;
alter table checklists enable row level security;
alter table communications enable row level security;

-- ---------------------------------------------------------------------------
-- roles — readable by any authenticated user (drives UI gating), writable
-- by admins only.
-- ---------------------------------------------------------------------------
create policy roles_select on roles for select to authenticated using (true);
create policy roles_write on roles for all to authenticated
  using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- companies — admins full access; employees read only their assigned
-- companies.
-- ---------------------------------------------------------------------------
create policy companies_admin_all on companies for all to authenticated
  using (is_admin()) with check (is_admin());
create policy companies_employee_select on companies for select to authenticated
  using (id in (select user_company_ids()));

-- ---------------------------------------------------------------------------
-- sites — admins full access; employees read sites of their companies.
-- ---------------------------------------------------------------------------
create policy sites_admin_all on sites for all to authenticated
  using (is_admin()) with check (is_admin());
create policy sites_employee_select on sites for select to authenticated
  using (company_id in (select user_company_ids()));

-- ---------------------------------------------------------------------------
-- employees — admins full access; an employee can read/update their own row.
-- ---------------------------------------------------------------------------
create policy employees_admin_all on employees for all to authenticated
  using (is_admin()) with check (is_admin());
create policy employees_self_select on employees for select to authenticated
  using (id = auth.uid());
create policy employees_self_update on employees for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- employee_companies — admins manage; employees read their own memberships.
-- ---------------------------------------------------------------------------
create policy employee_companies_admin_all on employee_companies for all to authenticated
  using (is_admin()) with check (is_admin());
create policy employee_companies_self_select on employee_companies for select to authenticated
  using (employee_id = auth.uid());

-- ---------------------------------------------------------------------------
-- attendance — admins read all; employees manage only their own rows,
-- scoped to a company they're assigned to. `geo_verified` is set by the
-- server action after re-checking the geofence — never trust a client
-- write of true for that column (enforce in the Server Action, not just RLS).
-- ---------------------------------------------------------------------------
create policy attendance_admin_select on attendance for select to authenticated
  using (is_admin());
create policy attendance_self_select on attendance for select to authenticated
  using (employee_id = auth.uid());
create policy attendance_self_insert on attendance for insert to authenticated
  with check (employee_id = auth.uid() and company_id in (select user_company_ids()));
create policy attendance_self_update on attendance for update to authenticated
  using (employee_id = auth.uid()) with check (employee_id = auth.uid());

-- ---------------------------------------------------------------------------
-- audits — admins full access. Employees see their own audits (self-report
-- or assigned) and can create new ones (status starts at 'submit'); marks /
-- status progression is admin-only.
-- ---------------------------------------------------------------------------
create policy audits_admin_all on audits for all to authenticated
  using (is_admin()) with check (is_admin());
create policy audits_self_select on audits for select to authenticated
  using (employee_id = auth.uid());
create policy audits_self_insert on audits for insert to authenticated
  with check (employee_id = auth.uid() and company_id in (select user_company_ids()));

-- ---------------------------------------------------------------------------
-- checklist_templates — admins full access; employees may read templates
-- belonging to their companies (used to render assigned-checklist context).
-- ---------------------------------------------------------------------------
create policy checklist_templates_admin_all on checklist_templates for all to authenticated
  using (is_admin()) with check (is_admin());
create policy checklist_templates_employee_select on checklist_templates for select to authenticated
  using (company_id in (select user_company_ids()));

-- ---------------------------------------------------------------------------
-- checklists — admins full access (assign/review). Employees see and
-- submit only their own assigned instances.
-- ---------------------------------------------------------------------------
create policy checklists_admin_all on checklists for all to authenticated
  using (is_admin()) with check (is_admin());
create policy checklists_self_select on checklists for select to authenticated
  using (employee_id = auth.uid());
create policy checklists_self_update on checklists for update to authenticated
  using (employee_id = auth.uid()) with check (employee_id = auth.uid());

-- ---------------------------------------------------------------------------
-- communications — admins see/respond to all; employees see and post only
-- within their own companies.
-- ---------------------------------------------------------------------------
create policy communications_admin_all on communications for all to authenticated
  using (is_admin()) with check (is_admin());
create policy communications_employee_select on communications for select to authenticated
  using (company_id in (select user_company_ids()));
create policy communications_employee_insert on communications for insert to authenticated
  with check (employee_id = auth.uid() and company_id in (select user_company_ids()));

-- ---------------------------------------------------------------------------
-- Storage — audit/checklist images: admins full access; employees can
-- upload/read within a path prefixed by their own employee id
-- (`{employee_id}/...`), enforced via the storage.objects `name` path.
-- ---------------------------------------------------------------------------
create policy audit_images_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'audit-images' and is_admin())
  with check (bucket_id = 'audit-images' and is_admin());
create policy audit_images_employee_own on storage.objects for all to authenticated
  using (bucket_id = 'audit-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'audit-images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy checklist_images_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'checklist-images' and is_admin())
  with check (bucket_id = 'checklist-images' and is_admin());
create policy checklist_images_employee_own on storage.objects for all to authenticated
  using (bucket_id = 'checklist-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'checklist-images' and (storage.foldername(name))[1] = auth.uid()::text);
