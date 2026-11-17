-- Each checklist has its own "done by" time: the hour, the morning after its
-- day, until which it's still on time (0 = midnight, i.e. the end of its own
-- day; 10 = 10:00 next morning, the default). Night work is common, so a
-- Monday checklist with done by 10 is on time until Tuesday 10:00, then
-- shows as expired (it can still be submitted).
--
-- Set per checklist on the dashboard. Each day's copy takes it from its
-- checklist; changing it updates the copies still to do. The app and the
-- "Checklist expired" push follow it.

alter table public.checklist_templates
  add column if not exists day_ends_at_hour smallint not null default 10 check (day_ends_at_hour between 0 and 12);
alter table public.checklists
  add column if not exists day_ends_at_hour smallint not null default 10 check (day_ends_at_hour between 0 and 12);

-- A new day's copy takes its checklist's time.
create or replace function public.checklists_take_done_by()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.template_id is not null then
    select t.day_ends_at_hour into new.day_ends_at_hour from checklist_templates t where t.id = new.template_id;
    new.day_ends_at_hour := coalesce(new.day_ends_at_hour, 10);
  end if;
  return new;
end;
$$;
drop trigger if exists checklists_take_done_by on public.checklists;
create trigger checklists_take_done_by before insert on public.checklists
  for each row execute function public.checklists_take_done_by();

-- Changing it updates the copies still to do.
create or replace function public.checklist_templates_share_done_by()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update checklists set day_ends_at_hour = new.day_ends_at_hour
   where template_id = new.id and status = 'pending' and day_ends_at_hour is distinct from new.day_ends_at_hour;
  return new;
end;
$$;
drop trigger if exists checklist_templates_share_done_by on public.checklist_templates;
create trigger checklist_templates_share_done_by after update of day_ends_at_hour on public.checklist_templates
  for each row execute function public.checklist_templates_share_done_by();

-- Hourly reminders (0067): "Checklist expired" goes out at each checklist's own time.
create or replace function public.push_daily_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare
  local_now timestamp := now() at time zone 'Australia/Sydney';
  today date := local_now::date;
  hour int := extract(hour from local_now);
  r record;
begin
  -- Yesterday's checklists whose done-by time is this hour, still not submitted.
  for r in
    select c.employee_id, count(*) as n, min(c.id::text) as one_id, min(push_place(c.company_id, c.site)) as place
      from checklists c
     where c.status = 'pending' and c.assigned_date = today - 1 and c.day_ends_at_hour = hour and c.employee_id is not null
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
