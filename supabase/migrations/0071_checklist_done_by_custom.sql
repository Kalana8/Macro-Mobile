-- "Done by" can now be any hour on the checklist's own day or the next day,
-- set as a time with AM/PM on the dashboard (e.g. same day 5:00 pm, or next
-- day 10:00 am).
--
-- due_hours = hours after the start (midnight) of the checklist's day:
--   1..24  the same day (17 = 5:00 pm, 24 = midnight at the end of the day)
--   25..47 the next day  (34 = 10:00 am next morning, the default)
--
-- An admin can also give one expired checklist more time ("Extend to…" on
-- the dashboard): extended_due_hours, counted the same way (from the start
-- of its day), replaces the done-by time for that checklist only. Editing
-- the checklist's template doesn't undo it.
--
-- day_ends_at_hour (0068) stays, kept in step, for app builds already on
-- phones: same-day times show to them as midnight, next-day times after
-- noon as noon. New builds use due_hours.

alter table public.checklist_templates add column if not exists due_hours smallint check (due_hours between 1 and 47);
alter table public.checklists add column if not exists due_hours smallint check (due_hours between 1 and 47);

alter table public.checklists add column if not exists extended_due_hours integer check (extended_due_hours between 1 and 1488);

update public.checklist_templates set due_hours = 24 + day_ends_at_hour where due_hours is null;
update public.checklists set due_hours = 24 + day_ends_at_hour where due_hours is null;

-- Keeps the two columns in step, whichever one was written.
create or replace function public.checklist_sync_done_by()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.due_hours is null then new.due_hours := 24 + coalesce(new.day_ends_at_hour, 10); end if;
  elsif new.due_hours is not distinct from old.due_hours and new.day_ends_at_hour is distinct from old.day_ends_at_hour then
    new.due_hours := 24 + new.day_ends_at_hour;
  end if;
  new.day_ends_at_hour := greatest(0, least(12, new.due_hours - 24));
  return new;
end;
$$;

drop trigger if exists checklist_templates_sync_done_by on public.checklist_templates;
create trigger checklist_templates_sync_done_by before insert or update on public.checklist_templates
  for each row execute function public.checklist_sync_done_by();
drop trigger if exists checklists_sync_done_by on public.checklists;
create trigger checklists_sync_done_by before insert or update on public.checklists
  for each row execute function public.checklist_sync_done_by();

-- Only admins give a checklist more time (staff can update their own
-- checklists to tick and submit them, but not this).
create or replace function public.checklists_extend_admin_only()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.extended_due_hours is distinct from (case when tg_op = 'INSERT' then null else old.extended_due_hours end)
     and auth.uid() is not null and not public.is_admin() then
    new.extended_due_hours := case when tg_op = 'INSERT' then null else old.extended_due_hours end;
  end if;
  return new;
end;
$$;
drop trigger if exists checklists_extend_admin_only on public.checklists;
create trigger checklists_extend_admin_only before insert or update on public.checklists
  for each row execute function public.checklists_extend_admin_only();

alter table public.checklist_templates alter column due_hours set not null;
alter table public.checklists alter column due_hours set not null;

-- A new day's copy takes its checklist's time (runs after the sync trigger, by name).
create or replace function public.checklists_take_done_by()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.template_id is not null then
    select t.due_hours, t.day_ends_at_hour into new.due_hours, new.day_ends_at_hour
      from checklist_templates t where t.id = new.template_id;
    new.due_hours := coalesce(new.due_hours, 34);
    new.day_ends_at_hour := coalesce(new.day_ends_at_hour, 10);
  end if;
  return new;
end;
$$;

-- Changing it updates the copies still to do.
create or replace function public.checklist_templates_share_done_by()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update checklists set due_hours = new.due_hours
   where template_id = new.id and status = 'pending' and due_hours is distinct from new.due_hours;
  return new;
end;
$$;
drop trigger if exists checklist_templates_share_done_by on public.checklist_templates;
create trigger checklist_templates_share_done_by after update of due_hours, day_ends_at_hour on public.checklist_templates
  for each row execute function public.checklist_templates_share_done_by();

-- Hourly reminders: "Checklist expired" goes out at each checklist's own time.
create or replace function public.push_daily_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare
  local_now timestamp := now() at time zone 'Australia/Sydney';
  today date := local_now::date;
  hour int := extract(hour from local_now);
  r record;
begin
  -- Checklists whose done-by time is this hour, still not submitted.
  for r in
    select c.employee_id, count(*) as n, min(c.id::text) as one_id, min(push_place(c.company_id, c.site)) as place
      from checklists c
     where c.status = 'pending' and c.employee_id is not null
       and c.assigned_date >= today - 62
       and c.assigned_date + make_interval(hours => coalesce(c.extended_due_hours, c.due_hours)) = date_trunc('hour', local_now)
     group by c.employee_id
  loop
    perform push_to(array[r.employee_id], 'Checklist expired',
      case when r.n = 1 then r.place || ' · you can still complete it' else r.n || ' checklists · you can still complete them' end,
      case when r.n = 1 then '/checklist/' || r.one_id else '/checklists' end);
  end loop;

  if hour = 8 then
    for r in
      select t.employee_id, coalesce(tpl.name, 'Site induction') as what
        from induction_tokens t
        left join induction_templates tpl on tpl.id = t.template_id
       where t.status = 'active'
         and t.expires_at > now() + interval '24 hours' and t.expires_at <= now() + interval '48 hours'
         and not exists (select 1 from induction_submissions s where s.token_id = t.id and s.status::text in ('approved', 'completed', 'pending_approval'))
    loop
      perform push_to(array[r.employee_id], 'Induction expires soon', r.what || ' · complete it in the next 2 days', '/profile');
    end loop;

    for r in
      select pr.recipient_id, count(*) as n
        from photo_share_recipients pr join photo_shares p on p.id = pr.share_id
       where (p.created_at at time zone 'Australia/Sydney')::date = today - 27
       group by pr.recipient_id
    loop
      perform push_to(array[r.recipient_id], 'Photos deleted in 3 days', 'Download any you want to keep.', '/photos');
    end loop;
  end if;
end;
$$;
revoke execute on function public.push_daily_reminders() from public, anon, authenticated;
