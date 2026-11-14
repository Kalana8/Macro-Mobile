-- Per-person access on shared weekly reports, chosen by the admin when sharing:
-- 'view' (read only) or 'edit' (change and add sections). Someone with edit
-- access can submit the report back to the office once; after that it is view
-- only for them, until the admin shares it again.
-- Reports already shared before this migration stay view only.

alter table public.weekly_report_recipients
  add column if not exists access text not null default 'view' check (access in ('view', 'edit')),
  add column if not exists submitted_at timestamptz;

create or replace function public.weekly_report_recipients_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_admin() then
    -- Everything except seen_at, and a one-off submit, stays as the admin set it.
    new.report_id := old.report_id;
    new.employee_id := old.employee_id;
    new.shared_by := old.shared_by;
    new.note := old.note;
    new.access := old.access;
    new.shared_at := old.shared_at;
    if old.submitted_at is not null or old.access <> 'edit' or new.submitted_at is null then
      new.submitted_at := old.submitted_at;
    else
      new.submitted_at := now(); -- The server, not the phone, records when.
    end if;
  end if;
  return new;
end;
$$;

/** Edit access that hasn't been handed back to the office yet. */
create or replace function public.can_edit_weekly_report_as_recipient(target_report_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.weekly_report_recipients
     where report_id = target_report_id and employee_id = auth.uid()
       and access = 'edit' and submitted_at is null
  );
$$;

drop policy if exists report_sections_recipient_update on public.report_sections;
create policy report_sections_recipient_update on public.report_sections for update to authenticated
  using (public.can_edit_weekly_report_as_recipient(report_id))
  with check (public.can_edit_weekly_report_as_recipient(report_id));

drop policy if exists report_sections_recipient_insert on public.report_sections;
create policy report_sections_recipient_insert on public.report_sections for insert to authenticated
  with check (public.can_edit_weekly_report_as_recipient(report_id));
