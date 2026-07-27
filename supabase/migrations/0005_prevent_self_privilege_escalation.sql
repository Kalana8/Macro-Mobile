-- employees_self_update (0002_rls.sql) lets an employee update their own
-- row, which is needed for things like clearing must_change_password on
-- first login. But RLS is row-level, not column-level — as written, that
-- same policy would also let an employee change their own access_role_id
-- or status. Enforce column-level immutability for non-admins with a
-- trigger, since RLS policies can't compare OLD vs NEW column-by-column.
create or replace function prevent_employee_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then
    if new.access_role_id is distinct from old.access_role_id then
      raise exception 'Only an admin can change an employee''s access role.';
    end if;
    if new.status is distinct from old.status then
      raise exception 'Only an admin can change an employee''s status.';
    end if;
  end if;
  return new;
end;
$$;

create trigger employees_prevent_self_privilege_escalation
  before update on employees
  for each row
  execute function prevent_employee_self_privilege_escalation();
