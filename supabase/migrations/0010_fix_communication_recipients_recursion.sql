-- 0009's communication_recipients_self_select policy queried
-- communication_recipients from within its own USING clause, which
-- Postgres's RLS planner rejects as self-referential ("infinite recursion
-- detected in policy for relation communication_recipients") — every read
-- of communications/communication_recipients was failing with a 500.
-- Same fix as is_admin()/user_company_ids(): a SECURITY DEFINER helper that
-- bypasses RLS internally, so the policy itself never re-triggers RLS.
create or replace function is_communication_recipient(target_communication_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from communication_recipients
    where communication_id = target_communication_id and employee_id = auth.uid()
  );
$$;

drop policy if exists communication_recipients_self_select on communication_recipients;
create policy communication_recipients_self_select on communication_recipients for select to authenticated
  using (employee_id = auth.uid() or is_communication_recipient(communication_id));

drop policy if exists communications_employee_select on communications;
create policy communications_employee_select on communications for select to authenticated
  using (is_communication_recipient(id));

-- Matches is_admin()/user_company_ids(): authenticated needs EXECUTE for
-- RLS policy evaluation itself (the querying role calls this function as
-- part of the policy check) — only anon/public are excluded.
revoke execute on function is_communication_recipient(uuid) from public;
revoke execute on function is_communication_recipient(uuid) from anon;
