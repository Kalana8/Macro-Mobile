-- A "Client" account isn't the employee who performed the checklist, so
-- the existing checklists_self_select policy (employee_id = auth.uid())
-- never matches them — they'd see an empty list. Grant read access scoped
-- to their own company(ies) instead, but only for accounts whose role has
-- app.checklists.imagesOnly set — regular employees keep seeing only their
-- own checklists, not their whole company's.
create or replace function has_checklist_images_only_access()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select (r.permissions->'app'->'checklists'->>'imagesOnly')::boolean
       from employees e
       join roles r on r.id = e.access_role_id
      where e.id = auth.uid()),
    false
  );
$$;

revoke execute on function has_checklist_images_only_access() from public;
revoke execute on function has_checklist_images_only_access() from anon;

create policy checklists_client_select on checklists for select to authenticated
  using (has_checklist_images_only_access() and company_id in (select user_company_ids()));
