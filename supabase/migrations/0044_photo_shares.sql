-- Photo sharing: an employee (or admin) sends one or more photos with a note to
-- chosen people. Visibility is participant-only, matching chat
-- (0024_communications_no_admin_oversight): the sender and the chosen
-- recipients see a share, and nobody else, admins included.
--
-- Photos live in the private `shared-photos` bucket under {sender_id}/..., and
-- `images` stores those object paths. Clients show them through short-lived
-- signed URLs, so a photo is never reachable by a public link.

create table if not exists public.photo_shares (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null default auth.uid() references public.employees(id) on delete cascade,
  company_id uuid references public.companies(id) on delete set null,
  note text not null default '' check (char_length(note) <= 1000),
  images text[] not null check (cardinality(images) between 1 and 10),
  created_at timestamptz not null default now()
);

create table if not exists public.photo_share_recipients (
  share_id uuid not null references public.photo_shares(id) on delete cascade,
  recipient_id uuid not null references public.employees(id) on delete cascade,
  seen_at timestamptz,
  primary key (share_id, recipient_id)
);

create index if not exists photo_share_recipients_recipient_idx on public.photo_share_recipients (recipient_id);
create index if not exists photo_shares_sender_idx on public.photo_shares (sender_id);

alter table public.photo_shares enable row level security;
alter table public.photo_share_recipients enable row level security;

-- Security definer so the two tables' policies can refer to each other
-- without recursing (the same approach as is_communication_recipient).
create or replace function public.is_photo_share_recipient(target_share_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from photo_share_recipients where share_id = target_share_id and recipient_id = auth.uid());
$$;

create or replace function public.is_photo_share_sender(target_share_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from photo_shares where id = target_share_id and sender_id = auth.uid());
$$;

/** Whether the caller may send photos to this person: any admin, or anyone sharing one of the caller's companies. Admins may send to anyone. */
create or replace function public.can_send_photos_to(target_employee_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target_employee_id <> auth.uid() and (
    public.is_admin()
    or exists (select 1 from employees e join roles r on r.id = e.access_role_id where e.id = target_employee_id and r.is_admin)
    or exists (select 1 from employee_companies ec where ec.employee_id = target_employee_id and ec.company_id in (select public.user_company_ids()))
  );
$$;

/** The people the caller can send photos to, plus their own name, for showing senders and recipients by name. */
create or replace function public.photo_share_contacts()
returns table (id uuid, full_name text, is_admin boolean)
language sql stable security definer set search_path = public as $$
  select e.id, e.full_name, coalesce(r.is_admin, false)
  from employees e left join roles r on r.id = e.access_role_id
  where e.status <> 'inactive' and (e.id = auth.uid() or public.can_send_photos_to(e.id))
  order by coalesce(r.is_admin, false) desc, e.full_name;
$$;

revoke execute on function public.is_photo_share_recipient(uuid), public.is_photo_share_sender(uuid), public.can_send_photos_to(uuid), public.photo_share_contacts() from public, anon;
grant execute on function public.is_photo_share_recipient(uuid), public.is_photo_share_sender(uuid), public.can_send_photos_to(uuid), public.photo_share_contacts() to authenticated;

drop policy if exists photo_shares_participant_select on public.photo_shares;
create policy photo_shares_participant_select on public.photo_shares for select
  using (sender_id = auth.uid() or public.is_photo_share_recipient(id));

drop policy if exists photo_shares_sender_insert on public.photo_shares;
create policy photo_shares_sender_insert on public.photo_shares for insert
  with check (
    sender_id = auth.uid()
    and (company_id is null or public.is_admin() or company_id in (select public.user_company_ids()))
    and not exists (select 1 from unnest(images) p where p not like auth.uid()::text || '/%')
  );

drop policy if exists photo_shares_sender_delete on public.photo_shares;
create policy photo_shares_sender_delete on public.photo_shares for delete
  using (sender_id = auth.uid());

drop policy if exists photo_share_recipients_participant_select on public.photo_share_recipients;
create policy photo_share_recipients_participant_select on public.photo_share_recipients for select
  using (recipient_id = auth.uid() or public.is_photo_share_sender(share_id));

drop policy if exists photo_share_recipients_sender_insert on public.photo_share_recipients;
create policy photo_share_recipients_sender_insert on public.photo_share_recipients for insert
  with check (public.is_photo_share_sender(share_id) and public.can_send_photos_to(recipient_id) and seen_at is null);

drop policy if exists photo_share_recipients_mark_seen on public.photo_share_recipients;
create policy photo_share_recipients_mark_seen on public.photo_share_recipients for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- A recipient may only stamp seen_at; nothing else about a share can change.
revoke update on public.photo_share_recipients from authenticated;
grant update (seen_at) on public.photo_share_recipients to authenticated;
revoke update on public.photo_shares from authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shared-photos', 'shared-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/heic', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists shared_photos_owner_insert on storage.objects;
create policy shared_photos_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'shared-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists shared_photos_owner_delete on storage.objects;
create policy shared_photos_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'shared-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists shared_photos_participant_select on storage.objects;
create policy shared_photos_participant_select on storage.objects for select to authenticated
  using (
    bucket_id = 'shared-photos' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (
        select 1 from public.photo_shares s
        join public.photo_share_recipients r on r.share_id = s.id
        where r.recipient_id = auth.uid() and storage.objects.name = any (s.images)
      )
    )
  );
