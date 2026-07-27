-- A communication can now be addressed to multiple employees, not just
-- one — the compose form lets an admin pick several people, and everyone
-- picked can see and reply in the same thread.
create table communication_recipients (
  communication_id uuid not null references communications(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  primary key (communication_id, employee_id)
);
create index communication_recipients_employee_id_idx on communication_recipients(employee_id);

-- Backfill: every existing thread's single employee_id becomes its first recipient.
insert into communication_recipients (communication_id, employee_id)
select id, employee_id from communications
on conflict do nothing;

alter table communication_recipients enable row level security;

create policy communication_recipients_admin_all on communication_recipients for all to authenticated
  using (is_admin()) with check (is_admin());
-- An employee can always see who else a thread was sent to, once they can
-- see the thread itself at all (communications_employee_select, below).
create policy communication_recipients_self_select on communication_recipients for select to authenticated
  using (
    employee_id = auth.uid()
    or exists (
      select 1 from communication_recipients cr2
      where cr2.communication_id = communication_recipients.communication_id
        and cr2.employee_id = auth.uid()
    )
  );
-- Employees can only ever add themselves as a recipient (e.g. reporting
-- their own issue) — only admins can address a thread to other people.
create policy communication_recipients_self_insert on communication_recipients for insert to authenticated
  with check (employee_id = auth.uid());

drop policy if exists communications_employee_select on communications;
drop policy if exists communications_employee_insert on communications;

alter table communications drop column employee_id;

create policy communications_employee_select on communications for select to authenticated
  using (
    exists (
      select 1 from communication_recipients cr
      where cr.communication_id = communications.id and cr.employee_id = auth.uid()
    )
  );

create policy communications_employee_insert on communications for insert to authenticated
  with check (company_id in (select user_company_ids()));
