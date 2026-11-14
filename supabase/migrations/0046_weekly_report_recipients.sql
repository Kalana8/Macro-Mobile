-- Lets an admin share a finished weekly report with chosen app users. Each
-- recipient can then read that report (sections, photos and PDFs) in the app,
-- but not change it, and is notified until they have opened it.

alter type report_share_channel add value if not exists 'app';

create table if not exists public.weekly_report_recipients (
  report_id uuid not null references public.weekly_reports(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  shared_by uuid references public.employees(id) on delete set null,
  note text check (char_length(note) <= 1000),
  shared_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (report_id, employee_id)
);
create index if not exists weekly_report_recipients_employee_idx on public.weekly_report_recipients(employee_id);

alter table public.weekly_report_recipients enable row level security;

drop policy if exists weekly_report_recipients_admin_all on public.weekly_report_recipients;
create policy weekly_report_recipients_admin_all on public.weekly_report_recipients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists weekly_report_recipients_own_select on public.weekly_report_recipients;
create policy weekly_report_recipients_own_select on public.weekly_report_recipients for select to authenticated
  using (employee_id = auth.uid());

-- Recipients may only mark their own row as seen.
drop policy if exists weekly_report_recipients_own_seen on public.weekly_report_recipients;
create policy weekly_report_recipients_own_seen on public.weekly_report_recipients for update to authenticated
  using (employee_id = auth.uid()) with check (employee_id = auth.uid());

create or replace function public.weekly_report_recipients_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_admin() then
    -- Everything except seen_at stays as the admin set it.
    new.report_id := old.report_id;
    new.employee_id := old.employee_id;
    new.shared_by := old.shared_by;
    new.note := old.note;
    new.shared_at := old.shared_at;
  end if;
  return new;
end;
$$;

drop trigger if exists weekly_report_recipients_guard on public.weekly_report_recipients;
create trigger weekly_report_recipients_guard
  before update on public.weekly_report_recipients
  for each row execute function public.weekly_report_recipients_guard();

create or replace function public.is_weekly_report_recipient(target_report_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.weekly_report_recipients
     where report_id = target_report_id and employee_id = auth.uid()
  );
$$;

-- Read-only access for recipients. Editing still needs the existing participant policies. Editing still needs the existing participant policies.
drop policy if exists weekly_reports_recipient_select on public.weekly_reports;
create policy weekly_reports_recipient_select on public.weekly_reports for select to authenticated
  using (public.is_weekly_report_recipient(id));

drop policy if exists report_sections_recipient_select on public.report_sections;
create policy report_sections_recipient_select on public.report_sections for select to authenticated
  using (public.is_weekly_report_recipient(report_id));

drop policy if exists report_photos_recipient_select on public.report_photos;
create policy report_photos_recipient_select on public.report_photos for select to authenticated
  using (public.is_weekly_report_recipient((select report_id from public.report_sections where id = section_id)));

drop policy if exists report_photo_annotations_recipient_select on public.report_photo_annotations;
create policy report_photo_annotations_recipient_select on public.report_photo_annotations for select to authenticated
  using (public.is_weekly_report_recipient((
    select s.report_id from public.report_photos p join public.report_sections s on s.id = p.section_id where p.id = photo_id
  )));

drop policy if exists report_pdfs_recipient_select on public.report_pdfs;
create policy report_pdfs_recipient_select on public.report_pdfs for select to authenticated
  using (public.is_weekly_report_recipient(report_id));
