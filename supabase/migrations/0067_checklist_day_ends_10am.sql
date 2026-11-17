-- A day's checklist is often worked overnight and finished the next morning
-- (e.g. Monday's done by 8–9 am Tuesday). Its day ends at 10:00 the next
-- morning (Sydney time), not at midnight. The app treats it the same way
-- (CHECKLIST_DAY_ENDS_AT_HOUR in src/lib/format.ts).
--
-- The daily reminders (0064) now run every hour and each goes out at the
-- right local time, whatever daylight saving is doing:
--   08:00  inductions expiring soon, photos deleted in 3 days
--   10:00  yesterday's checklists not submitted: now expired

create or replace function public.push_daily_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare
  local_now timestamp := now() at time zone 'Australia/Sydney';
  today date := local_now::date;
  hour int := extract(hour from local_now);
  r record;
begin
  -- 10:00: yesterday's checklists still not submitted have just expired.
  if hour = 10 then
    for r in
      select c.employee_id, count(*) as n, min(c.id::text) as one_id, min(push_place(c.company_id, c.site)) as place
        from checklists c
       where c.status = 'pending' and c.assigned_date = today - 1 and c.employee_id is not null
       group by c.employee_id
    loop
      perform push_to(array[r.employee_id], 'Checklist expired',
        case when r.n = 1 then r.place || ' · you can still complete it' else r.n || ' checklists · you can still complete them' end,
        case when r.n = 1 then '/checklist/' || r.one_id else '/checklists' end);
    end loop;
  end if;

  if hour = 8 then
    -- Inductions whose link expires in the next 1–2 days and aren't done.
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

    -- Photos received 27 days ago are deleted in 3 days.
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

select cron.unschedule('push-daily-reminders') where exists (select 1 from cron.job where jobname = 'push-daily-reminders');
select cron.schedule('push-daily-reminders', '2 * * * *', $$ select public.push_daily_reminders(); $$);
