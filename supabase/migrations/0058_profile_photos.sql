-- Profile photos: employees pick their own picture in the app.
--
-- The photo lives in the private "avatars" bucket at {employee_id}/{file};
-- employees.avatar_path points at it. Only the employee can upload, replace
-- or remove their own photo. Signed-in staff (colleagues, admins) can view
-- photos through short-lived signed URLs.

alter table public.employees add column if not exists avatar_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 5242880, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists avatars_owner_insert on storage.objects;
create policy avatars_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_owner_update on storage.objects;
create policy avatars_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatars_owner_delete on storage.objects;
create policy avatars_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

drop policy if exists avatars_staff_select on storage.objects;
create policy avatars_staff_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars');

/** An employee may only point avatar_path at their own folder (admins may clear it). */
create or replace function public.employees_avatar_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.avatar_path is distinct from old.avatar_path
     and new.avatar_path is not null
     and auth.uid() is not null
     and (storage.foldername(new.avatar_path))[1] is distinct from new.id::text then
    raise exception 'A profile photo must be in the employee''s own folder.' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists employees_avatar_guard on public.employees;
create trigger employees_avatar_guard
  before update of avatar_path on public.employees
  for each row execute function public.employees_avatar_guard();
