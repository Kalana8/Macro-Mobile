-- Photos attached to chat messages from the employee app. They live in the
-- private chat-images bucket at {communication_id}/{sender_id}/{file}, and
-- only the people in that conversation can upload to it or open them
-- (matching chat's participant-only rule, 0024). Firestore messages store
-- the object path; apps show it through a short-lived signed URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-images', 'chat-images', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

/** The conversation a chat-images object belongs to, or null if the path isn't one. */
create or replace function public.chat_image_conversation(object_name text)
returns uuid language sql stable set search_path = public as $$
  select case
    when (storage.foldername(object_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(object_name))[1])::uuid
  end;
$$;

drop policy if exists chat_images_participant_insert on storage.objects;
create policy chat_images_participant_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_communication_recipient(public.chat_image_conversation(name))
  );

drop policy if exists chat_images_participant_select on storage.objects;
create policy chat_images_participant_select on storage.objects for select to authenticated
  using (
    bucket_id = 'chat-images'
    and public.is_communication_recipient(public.chat_image_conversation(name))
  );

-- Senders may take back their own uploads (for example after a failed send).
drop policy if exists chat_images_owner_delete on storage.objects;
create policy chat_images_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'chat-images' and (storage.foldername(name))[2] = auth.uid()::text);
