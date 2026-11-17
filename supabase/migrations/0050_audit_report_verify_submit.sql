-- Audits and shared weekly reports become view only for employees. Instead of
-- editing, an employee:
--   * presses "Checked" on an audit or a report shared with them, so the
--     admin sees they have verified it (employee_verified_at / verified_at);
--   * may add a note and photos and submit them once
--     (audits: employee_note, employee_images, employee_submitted_at;
--      reports: response_note, response_images, submitted_at).
-- The server stamps every time; nothing else on the row can change.
--
-- This replaces the edit rights from 0045 (audit answers) and 0047 (report
-- sections). Their columns stay, unused, so nothing that reads them breaks.

-- ── Audits ──────────────────────────────────────────────────────────────────

alter table public.audits
  add column if not exists employee_verified_at timestamptz,
  add column if not exists employee_note text not null default '' check (char_length(employee_note) <= 2000),
  add column if not exists employee_images text[] not null default '{}' check (cardinality(employee_images) <= 20);

create or replace function public.audits_guard_employee_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if old.employee_submitted_at is not null or old.status = 'complete' then
    raise exception 'This audit has already been submitted.' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'employee_verified_at' - 'employee_note' - 'employee_images' - 'employee_submitted_at')
     is distinct from (to_jsonb(old) - 'employee_verified_at' - 'employee_note' - 'employee_images' - 'employee_submitted_at') then
    raise exception 'Audits are view only. You can mark one as checked, or add a note and photos.' using errcode = '42501';
  end if;
  -- Photos must be the employee's own uploads in the private audit-images bucket.
  if exists (select 1 from unnest(new.employee_images) p where p not like auth.uid()::text || '/%') then
    raise exception 'Invalid audit photos.' using errcode = '22023';
  end if;
  -- The server, not the phone, records when. Checked stays checked; submitting also counts as checked.
  if old.employee_verified_at is not null then
    new.employee_verified_at := old.employee_verified_at;
  elsif new.employee_verified_at is not null or new.employee_submitted_at is not null then
    new.employee_verified_at := now();
  end if;
  if new.employee_submitted_at is not null then
    new.employee_submitted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists audits_guard_employee_update on public.audits;
create trigger audits_guard_employee_update
  before update on public.audits
  for each row execute function public.audits_guard_employee_update();

-- Any audit assigned to you, whatever its old access setting, until it is submitted or closed.
drop policy if exists audits_assignee_update on public.audits;
create policy audits_assignee_update on public.audits for update
  using (employee_id = auth.uid() and employee_submitted_at is null and status <> 'complete')
  with check (employee_id = auth.uid());

-- ── Shared weekly reports ───────────────────────────────────────────────────

-- Same as audits: Checked (verified_at), then a note and photos submitted once.
-- Photos go in the private audit-images bucket under the employee's own folder.
alter table public.weekly_report_recipients
  add column if not exists verified_at timestamptz,
  add column if not exists response_note text not null default '' check (char_length(response_note) <= 2000),
  add column if not exists response_images text[] not null default '{}' check (cardinality(response_images) <= 20);
alter table public.weekly_report_recipients add column if not exists submitted_at timestamptz;

create or replace function public.weekly_report_recipients_guard()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.is_admin() then
    -- Everything except seen_at, a one-off "Checked" and a one-off response stays as the admin set it.
    new.report_id := old.report_id;
    new.employee_id := old.employee_id;
    new.shared_by := old.shared_by;
    new.note := old.note;
    new.access := old.access;
    new.shared_at := old.shared_at;
    if old.submitted_at is not null or new.submitted_at is null then
      -- Not submitting now: the response can't change.
      new.submitted_at := old.submitted_at;
      new.response_note := old.response_note;
      new.response_images := old.response_images;
    else
      if exists (select 1 from unnest(new.response_images) p where p not like auth.uid()::text || '/%') then
        raise exception 'Invalid report photos.' using errcode = '22023';
      end if;
      new.submitted_at := now(); -- The server, not the phone, records when.
    end if;
    -- Checked stays checked; submitting also counts as checked.
    if old.verified_at is not null then
      new.verified_at := old.verified_at;
    elsif new.verified_at is not null or new.submitted_at is not null then
      new.verified_at := now();
    end if;
  end if;
  return new;
end;
$$;

-- Recipients no longer edit report sections.
drop policy if exists report_sections_recipient_update on public.report_sections;
drop policy if exists report_sections_recipient_insert on public.report_sections;
drop function if exists public.can_edit_weekly_report_as_recipient(uuid);
