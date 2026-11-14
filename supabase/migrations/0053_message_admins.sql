-- Employees can include admins when they start a conversation, even though
-- admins usually aren't assigned to a company. Before this, recipients had
-- to share one of the sender's companies, so admins could never be added.
-- The conversation must still be in one of the sender's companies.

/** Whether this employee has an admin role. Security definer: employees can't read admin rows themselves. */
create or replace function public.is_admin_employee(target_employee_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from employees e join roles r on r.id = e.access_role_id
     where e.id = target_employee_id and r.is_admin and e.status <> 'inactive'
  );
$$;

revoke execute on function public.is_admin_employee(uuid) from public, anon;
grant execute on function public.is_admin_employee(uuid) to authenticated;

drop policy if exists communication_recipients_admin_target_insert on public.communication_recipients;
create policy communication_recipients_admin_target_insert on public.communication_recipients for insert to authenticated
  with check (
    public.is_admin_employee(employee_id)
    and exists (
      select 1 from public.communications c
       where c.id = communication_recipients.communication_id
         and c.company_id in (select public.user_company_ids())
    )
  );
