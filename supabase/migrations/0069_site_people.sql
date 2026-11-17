-- Who works at which site, for the app's pickers: Send photos, New message
-- and New audit. Only active employees, and only the sites they're on now:
-- someone removed from a site (or from the company, or deleted, or made
-- inactive) stops showing there straight away.
--
-- employee_sites (0062) is admin-only, so the app can't read colleagues'
-- sites directly. This returns just names, roles and places:
--   * admins and audit managers (0066): every site
--   * everyone else: the sites of the companies they belong to
-- A company with no sites set up lists its members with site_id null.

create or replace function public.site_people()
returns table (employee_id uuid, full_name text, role_name text, is_admin boolean, company_id uuid, site_id uuid)
language sql stable security definer set search_path = public as $$
  with allowed as (
    select c.id from companies c
     where public.is_admin() or public.manages_audits() or c.id in (select public.user_company_ids())
  )
  select e.id, e.full_name, coalesce(r.name, e.job_role), coalesce(r.is_admin, false), s.company_id, s.id
    from employee_sites es
    join sites s on s.id = es.site_id
    join employees e on e.id = es.employee_id
    left join roles r on r.id = e.access_role_id
   where e.status = 'active' and s.company_id in (select id from allowed)
  union all
  select e.id, e.full_name, coalesce(r.name, e.job_role), coalesce(r.is_admin, false), ec.company_id, null::uuid
    from employee_companies ec
    join employees e on e.id = ec.employee_id
    left join roles r on r.id = e.access_role_id
   where e.status = 'active' and ec.company_id in (select id from allowed)
     and not exists (select 1 from sites s where s.company_id = ec.company_id);
$$;
revoke execute on function public.site_people() from public, anon;
grant execute on function public.site_people() to authenticated;
