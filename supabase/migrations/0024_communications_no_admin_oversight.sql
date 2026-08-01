-- Communications become fully participant-only: not even Admin can see a
-- thread's title/preview/messages unless they're an actual recipient of it.
-- Previously `communications_admin_all` / `communication_recipients_admin_all`
-- granted Admin blanket SELECT (and everything else) on every row via
-- is_admin() — that's what let unrelated accounts see other people's chat
-- previews in the Comm Log / notifications. Admin keeps the ability to
-- create threads for any company/employee and to manage (update/delete)
-- any thread, but visibility now goes through the same
-- is_communication_recipient() check everyone else uses.

drop policy if exists communications_admin_all on communications;

create policy communications_admin_insert
  on communications for insert
  with check (is_admin());

create policy communications_admin_update
  on communications for update
  using (is_admin())
  with check (is_admin());

create policy communications_admin_delete
  on communications for delete
  using (is_admin());

drop policy if exists communication_recipients_admin_all on communication_recipients;

create policy communication_recipients_admin_insert
  on communication_recipients for insert
  with check (is_admin());

create policy communication_recipients_admin_update
  on communication_recipients for update
  using (is_admin())
  with check (is_admin());

create policy communication_recipients_admin_delete
  on communication_recipients for delete
  using (is_admin());
