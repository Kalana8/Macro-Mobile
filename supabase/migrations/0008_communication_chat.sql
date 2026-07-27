-- Communication threads now target a specific site (not just company) and
-- track when the conversation last had activity — the actual message
-- bodies/images live in Firebase Firestore (see packages/shared/src/firebase),
-- this table is just the durable metadata + access-control anchor.
alter table communications add column if not exists site_id uuid references sites(id) on delete set null;
alter table communications add column if not exists last_message_at timestamptz;

-- Employees could previously see every thread across a company they belong
-- to, even ones about a coworker — these are meant to be private 1:1
-- threads between one employee and admin, so tighten to their own.
drop policy if exists communications_employee_select on communications;
create policy communications_employee_select on communications for select to authenticated
  using (employee_id = auth.uid());

insert into storage.buckets (id, name, public)
values ('communication-images', 'communication-images', false)
on conflict (id) do nothing;

create policy communication_images_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'communication-images' and is_admin())
  with check (bucket_id = 'communication-images' and is_admin());
create policy communication_images_employee_own on storage.objects for all to authenticated
  using (bucket_id = 'communication-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'communication-images' and (storage.foldername(name))[1] = auth.uid()::text);
