-- Checks: documents every employee has to hand in (by default a Police Check
-- and a VEVO Check), next to inductions on "Induction and Check Links".
--
-- check_types lists what's required. An employee uploads a document for each
-- from the app; the office approves it (optionally with an expiry date) or
-- sends it back with a note. No row in employee_checks means "not handed in".
--
-- Employees can only hand in their own documents, and anything they write
-- comes back as "submitted": only an admin can approve or reject. Documents
-- live in the private employee-checks bucket at {employee_id}/{file}; the
-- employee and admins can open them, through short-lived signed URLs.

create table if not exists public.check_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 80),
  description text not null default '',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.check_types (name, description, sort)
values
  ('Police Check', 'A National Police Check certificate (photo or PDF).', 1),
  ('VEVO Check', 'Your VEVO work rights result (photo, screenshot or PDF).', 2)
on conflict (name) do nothing;

alter table public.check_types enable row level security;
drop policy if exists check_types_read on public.check_types;
create policy check_types_read on public.check_types for select to authenticated using (true);
drop policy if exists check_types_admin_all on public.check_types;
create policy check_types_admin_all on public.check_types for all to authenticated
  using (is_admin()) with check (is_admin());

create table if not exists public.employee_checks (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  check_type_id uuid not null references public.check_types(id) on delete cascade,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  document_path text not null,
  file_name text not null default '',
  note text not null default '',
  expires_on date,
  review_note text,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.employees(id) on delete set null,
  reviewed_at timestamptz,
  unique (employee_id, check_type_id)
);
create index if not exists employee_checks_employee_idx on public.employee_checks(employee_id);

alter table public.employee_checks enable row level security;
drop policy if exists employee_checks_read on public.employee_checks;
create policy employee_checks_read on public.employee_checks for select to authenticated
  using (employee_id = auth.uid() or is_admin());
drop policy if exists employee_checks_insert on public.employee_checks;
create policy employee_checks_insert on public.employee_checks for insert to authenticated
  with check (employee_id = auth.uid() or is_admin());
drop policy if exists employee_checks_update on public.employee_checks;
create policy employee_checks_update on public.employee_checks for update to authenticated
  using (employee_id = auth.uid() or is_admin())
  with check (employee_id = auth.uid() or is_admin());
drop policy if exists employee_checks_admin_delete on public.employee_checks;
create policy employee_checks_admin_delete on public.employee_checks for delete to authenticated
  using (is_admin());

/**
 * An employee's own write is always a fresh hand-in: status "submitted",
 * stamped now, previous review cleared. They can't replace an approved
 * document that hasn't expired, or point at someone else's file.
 */
create or replace function public.employee_checks_guard()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- The SQL editor and the service role (no signed-in user) are trusted; the
  -- app's anon key can't reach this table at all (no policy for anon).
  if auth.uid() is null then
    return new;
  end if;
  if is_admin() then
    if new.status in ('approved', 'rejected') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
      new.reviewed_by := auth.uid();
      new.reviewed_at := now();
    end if;
    return new;
  end if;

  if new.employee_id is distinct from auth.uid() then
    raise exception 'You can only hand in your own checks.' using errcode = '42501';
  end if;
  if (storage.foldername(new.document_path))[1] is distinct from auth.uid()::text then
    raise exception 'Upload the document to your own folder.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if new.check_type_id <> old.check_type_id then
      raise exception 'A check can''t change type.' using errcode = '42501';
    end if;
    if old.status = 'approved' and (old.expires_on is null or old.expires_on >= current_date) then
      raise exception 'This check is already approved.' using errcode = '42501';
    end if;
  end if;
  new.status := 'submitted';
  new.submitted_at := now();
  new.expires_on := null;
  new.review_note := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  return new;
end;
$$;

drop trigger if exists employee_checks_guard on public.employee_checks;
create trigger employee_checks_guard
  before insert or update on public.employee_checks
  for each row execute function public.employee_checks_guard();

-- Documents.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('employee-checks', 'employee-checks', false, 10485760,
        array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists employee_checks_owner_insert on storage.objects;
create policy employee_checks_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'employee-checks' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists employee_checks_owner_or_admin_select on storage.objects;
create policy employee_checks_owner_or_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'employee-checks' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

drop policy if exists employee_checks_owner_or_admin_delete on storage.objects;
create policy employee_checks_owner_or_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'employee-checks' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

-- An earlier draft of this file named it "Brevo Check". Fold it into
-- "VEVO Check": documents handed in for it move across (unless the employee
-- already has a VEVO one), then the Brevo row goes.
update public.employee_checks ec
   set check_type_id = v.id
  from public.check_types b, public.check_types v
 where b.name = 'Brevo Check' and v.name = 'VEVO Check'
   and ec.check_type_id = b.id
   and not exists (select 1 from public.employee_checks x where x.employee_id = ec.employee_id and x.check_type_id = v.id);
delete from public.check_types where name = 'Brevo Check';
