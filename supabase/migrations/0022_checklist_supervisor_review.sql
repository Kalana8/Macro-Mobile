-- Supervisor (and any role with app.checklists.reviewAll set) can see every
-- submitted checklist for their assigned company, not just their own —
-- the opposite direction from Client's imagesOnly restriction: full detail,
-- broader scope. Mirrors has_checklist_images_only_access()'s pattern.
create or replace function has_checklist_review_access()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select (r.permissions->'app'->'checklists'->>'reviewAll')::boolean
       from employees e
       join roles r on r.id = e.access_role_id
      where e.id = auth.uid()),
    false
  );
$$;

revoke execute on function has_checklist_review_access() from public;
revoke execute on function has_checklist_review_access() from anon;

create policy checklists_reviewer_select on checklists for select to authenticated
  using (has_checklist_review_access() and company_id in (select user_company_ids()));

-- has_checklist_review_access() lets a Supervisor see other employees'
-- checklists, but employees_self_select (id = auth.uid()) still blocks the
-- joined employees(full_name) lookup for anyone but themselves — the name
-- would render blank. Let a reviewer see the profile row of any employee
-- who shares one of their companies.
create policy employees_reviewer_select on employees for select to authenticated
  using (
    has_checklist_review_access()
    and exists (
      select 1 from employee_companies ec
      where ec.employee_id = employees.id
        and ec.company_id in (select user_company_ids())
    )
  );

update roles
set permissions = jsonb_set(permissions, '{app,checklists,reviewAll}', 'true'::jsonb)
where name = 'Supervisor';
