-- Auditors manage audits in the app and on the dashboard, as an admin does.
--
-- Until now only full admins (roles.is_admin) could create, mark, send or
-- delete audits for other people; an Auditor role with the dashboard's audit
-- permissions was still blocked by the database. These rules follow the
-- role's Roles & Access → Dashboard → Audits switches:
--   createEdit   create audits and assign them to employees
--   enterMarks   rate sub-audits, give marks, save
--   sendResults  mark complete and send to chosen people
--   delete       delete audits
-- Audit managers work across all companies (the Auditor role isn't tied to
-- one), so they can also read the companies, sites and employees they pick
-- from. Everyone else is unchanged.

create or replace function public.audit_permission(key text)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((
    select (r.permissions -> 'dashboard' -> 'audits' ->> key)::boolean
      from employees e join roles r on r.id = e.access_role_id
     where e.id = auth.uid() and e.status = 'active'
  ), false);
$$;
revoke execute on function public.audit_permission(text) from public, anon;
grant execute on function public.audit_permission(text) to authenticated;

create or replace function public.manages_audits()
returns boolean language sql stable security definer set search_path = public as $$
  select audit_permission('createEdit') or audit_permission('enterMarks') or audit_permission('sendResults');
$$;
revoke execute on function public.manages_audits() from public, anon;
grant execute on function public.manages_audits() to authenticated;

-- Audits
drop policy if exists audits_manager_select on public.audits;
create policy audits_manager_select on public.audits for select to authenticated
  using (audit_permission('view') or manages_audits() or audit_permission('delete'));
drop policy if exists audits_manager_insert on public.audits;
create policy audits_manager_insert on public.audits for insert to authenticated
  with check (audit_permission('createEdit'));
drop policy if exists audits_manager_update on public.audits;
create policy audits_manager_update on public.audits for update to authenticated
  using (manages_audits()) with check (manages_audits());
drop policy if exists audits_manager_delete on public.audits;
create policy audits_manager_delete on public.audits for delete to authenticated
  using (audit_permission('delete'));

-- The employee-response guard (0050) lets managers through, like admins.
create or replace function public.audits_guard_employee_update()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if public.is_admin() or public.manages_audits() then
    return new;
  end if;
  if old.employee_submitted_at is not null then
    raise exception 'This audit has already been submitted.' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'employee_verified_at' - 'employee_note' - 'employee_images' - 'employee_submitted_at')
     is distinct from (to_jsonb(old) - 'employee_verified_at' - 'employee_note' - 'employee_images' - 'employee_submitted_at') then
    raise exception 'Audits are view only. You can mark one as checked, or add a note and photos.' using errcode = '42501';
  end if;
  if exists (select 1 from unnest(new.employee_images) p where p not like auth.uid()::text || '/%') then
    raise exception 'Invalid audit photos.' using errcode = '22023';
  end if;
  if old.employee_verified_at is not null then
    new.employee_verified_at := old.employee_verified_at;
  elsif new.employee_verified_at is not null or new.employee_submitted_at is not null then
    new.employee_verified_at := now();
  end if;
  if new.employee_submitted_at is not null then
    new.employee_submitted_at := now();
  end if;
  return new;
end;
$function$;

-- What audit managers pick from: companies, sites, employees and who works where.
drop policy if exists companies_audit_manager_select on public.companies;
create policy companies_audit_manager_select on public.companies for select to authenticated using (manages_audits());
drop policy if exists sites_audit_manager_select on public.sites;
create policy sites_audit_manager_select on public.sites for select to authenticated using (manages_audits());
drop policy if exists employees_audit_manager_select on public.employees;
create policy employees_audit_manager_select on public.employees for select to authenticated using (manages_audits());
drop policy if exists employee_companies_audit_manager_select on public.employee_companies;
create policy employee_companies_audit_manager_select on public.employee_companies for select to authenticated using (manages_audits());
