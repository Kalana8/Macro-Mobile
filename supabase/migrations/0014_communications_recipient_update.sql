-- Sending a message calls touchCommunicationAction, which updates the
-- thread's last_update/last_message_at/status in Postgres right after the
-- Firestore write succeeds. There was no UPDATE policy for non-admins, only
-- communications_admin_all — so every employee message send failed with
-- "new row violates row-level security policy for table communications".
-- Recipients (via is_communication_recipient, from 0010) may now update
-- their own threads.
create policy communications_recipient_update on communications for update to authenticated
  using (is_communication_recipient(id))
  with check (is_communication_recipient(id));
