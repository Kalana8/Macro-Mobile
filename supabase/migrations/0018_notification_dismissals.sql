-- Lets an employee permanently dismiss a notification bell item (checklist/
-- communication/audit) so it stops reappearing once "crossed" — tracked
-- server-side (not localStorage) so it stays dismissed across devices.
create table notification_dismissals (
  employee_id uuid not null references employees(id) on delete cascade,
  item_type text not null check (item_type in ('checklist', 'communication', 'audit')),
  item_id uuid not null,
  dismissed_at timestamptz not null default now(),
  primary key (employee_id, item_type, item_id)
);

alter table notification_dismissals enable row level security;

create policy notification_dismissals_self_all on notification_dismissals for all to authenticated
  using (employee_id = auth.uid())
  with check (employee_id = auth.uid());

-- Audit results are "sent" to a broadcast list (sent_to), separate from
-- the audit's own employee_id owner — recipients previously had no RLS
-- path to see the audit at all, so it could never show as a notification
-- for anyone but the owner.
create policy audits_recipient_select on audits for select to authenticated
  using (auth.uid() = any(sent_to));
