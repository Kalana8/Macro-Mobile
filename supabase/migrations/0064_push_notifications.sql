-- Push notifications to employees' phones (and browsers) for everything that
-- needs their attention. Each notification goes only to the people it is
-- for; tapping it opens the right screen in the app.
--
-- How it works: the triggers below call push_to(), which asks the send-push
-- Edge Function (over pg_net) to deliver it through Firebase. The function
-- only accepts calls carrying the push_secret, so nobody else can send.
--
-- ONE-TIME SETUP (SQL editor), with your own random secret:
--   select vault.create_secret('https://ysaovzdjtucywurhtzyx.supabase.co', 'project_url');
--   select vault.create_secret('<a long random string>', 'push_secret');
-- and set the same string as the Edge Function secret PUSH_SECRET.
-- Until then push_to() quietly does nothing, so nothing else is affected.
--
-- Events:
--   checklists           new checklist sent to you · a colleague submitted one (full-view roles)
--   audits               audit assigned to you · results sent
--   weekly_report_recipients  report shared with you
--   photo_share_recipients    photos sent to you
--   induction_tokens     new induction to complete
--   induction_submissions     induction approved · needs changes
--   employee_checks      check approved · sent back
--   daily, 8 am (Sydney summer time): checklist expired yesterday ·
--     induction expiring within 2 days · photos deleted in 3 days
-- Chat messages already go through the notify-chat function.

create extension if not exists pg_net with schema extensions;

-- Which kind of device a token belongs to (phones get a visible notification).
alter table public.device_tokens add column if not exists platform text not null default 'web';

create or replace function public.push_to(employee_ids uuid[], title text, body text, href text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  base text;
  secret text;
begin
  if employee_ids is null or cardinality(employee_ids) = 0 then return; end if;
  select decrypted_secret into base from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'push_secret';
  if base is null or secret is null then return; end if;
  perform net.http_post(
    url := base || '/functions/v1/send-push',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', secret),
    body := jsonb_build_object('employee_ids', to_jsonb(employee_ids), 'title', title, 'body', coalesce(body, ''), 'href', coalesce(href, '/')),
    timeout_milliseconds := 10000
  );
exception when others then
  -- A notification must never stop the change that caused it.
  null;
end;
$$;
revoke execute on function public.push_to(uuid[], text, text, text) from public, anon, authenticated;

/** "Seoul Garden – Glen Waverly" for a checklist. */
create or replace function public.push_place(company uuid, site text)
returns text language sql stable security definer set search_path = public as $$
  select concat_ws(' – ', (select name from companies where id = company), nullif(site, ''));
$$;
revoke execute on function public.push_place(uuid, text) from public, anon, authenticated;

-- ── Checklists ───────────────────────────────────────────────────────────
create or replace function public.push_checklists()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  reviewers uuid[];
begin
  if tg_op = 'INSERT' and new.status = 'pending' and new.employee_id is not null then
    perform push_to(array[new.employee_id], 'New checklist', push_place(new.company_id, new.site), '/checklist/' || new.id);
  elsif tg_op = 'UPDATE' and new.status = 'submitted' and old.status is distinct from 'submitted' then
    -- People who see the company's checklists in full (supervisors, clients).
    select array_agg(distinct e.id) into reviewers
      from employees e
      join employee_companies ec on ec.employee_id = e.id and ec.company_id = new.company_id
      join roles r on r.id = e.access_role_id
     where coalesce((r.permissions -> 'app' -> 'checklists' ->> 'reviewAll')::boolean, false)
       and e.id is distinct from new.employee_id
       and e.status = 'active';
    perform push_to(reviewers, 'Checklist submitted',
      concat_ws(' · ', (select full_name from employees where id = new.employee_id), push_place(new.company_id, new.site)),
      '/checklist/' || new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists checklists_push on public.checklists;
create trigger checklists_push after insert or update of status on public.checklists
  for each row execute function public.push_checklists();

-- ── Audits ───────────────────────────────────────────────────────────────
create or replace function public.push_audits()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.employee_id is null then return new; end if;
  if tg_op = 'INSERT' or new.employee_id is distinct from old.employee_id then
    perform push_to(array[new.employee_id], 'New audit to check', coalesce(nullif(new.title, ''), 'Audit'), '/audits/' || new.id);
  elsif new.status = 'complete' and old.status is distinct from 'complete' then
    perform push_to(array[new.employee_id], 'Audit results',
      coalesce(nullif(new.title, ''), 'Audit') || case when new.final_marks is not null then ' · ' || new.final_marks || ' / ' || new.max_marks else '' end,
      '/audits/' || new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists audits_push on public.audits;
create trigger audits_push after insert or update of employee_id, status on public.audits
  for each row execute function public.push_audits();

-- ── Reports ──────────────────────────────────────────────────────────────
create or replace function public.push_report_shared()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform push_to(array[new.employee_id], 'New report',
    (select concat_ws(' · ', 'Week ' || w.report_number, nullif(w.title, '')) from weekly_reports w where w.id = new.report_id),
    '/reports/' || new.report_id);
  return new;
end;
$$;
drop trigger if exists weekly_report_recipients_push on public.weekly_report_recipients;
create trigger weekly_report_recipients_push after insert on public.weekly_report_recipients
  for each row execute function public.push_report_shared();

-- ── Photos ───────────────────────────────────────────────────────────────
create or replace function public.push_photos_received()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform push_to(array[new.recipient_id], 'New photos',
    (select concat_ws(' · ', 'From ' || e.full_name, cardinality(p.images) || ' photo' || case when cardinality(p.images) = 1 then '' else 's' end)
       from photo_shares p left join employees e on e.id = p.sender_id where p.id = new.share_id),
    '/photos');
  return new;
end;
$$;
drop trigger if exists photo_share_recipients_push on public.photo_share_recipients;
create trigger photo_share_recipients_push after insert on public.photo_share_recipients
  for each row execute function public.push_photos_received();

-- ── Inductions ───────────────────────────────────────────────────────────
create or replace function public.push_induction_sent()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'active' then
    perform push_to(array[new.employee_id], 'New induction to complete',
      concat_ws(' · ', (select name from induction_templates where id = new.template_id), (select name from sites where id = new.site_id)),
      '/profile');
  end if;
  return new;
end;
$$;
drop trigger if exists induction_tokens_push on public.induction_tokens;
create trigger induction_tokens_push after insert on public.induction_tokens
  for each row execute function public.push_induction_sent();

create or replace function public.push_induction_reviewed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  what text := (select tpl.name from induction_tokens t left join induction_templates tpl on tpl.id = t.template_id where t.id = new.token_id);
begin
  if new.status::text = old.status::text then return new; end if;
  if new.status::text = 'approved' then
    perform push_to(array[new.employee_id], 'Induction approved', coalesce(what, 'Site induction'), '/profile');
  elsif new.status::text = 'rejected' then
    perform push_to(array[new.employee_id], 'Induction needs changes', concat_ws(': ', coalesce(what, 'Site induction'), nullif(new.review_note, '')), '/profile');
  end if;
  return new;
end;
$$;
drop trigger if exists induction_submissions_push on public.induction_submissions;
create trigger induction_submissions_push after update of status on public.induction_submissions
  for each row execute function public.push_induction_reviewed();

-- ── Checks (Police, VEVO, ...) ───────────────────────────────────────────
create or replace function public.push_check_reviewed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  what text := (select name from check_types where id = new.check_type_id);
begin
  if new.status = old.status then return new; end if;
  if new.status = 'approved' then
    perform push_to(array[new.employee_id], coalesce(what, 'Check') || ' approved', 'Thanks, it''s all done.', '/profile');
  elsif new.status = 'rejected' then
    perform push_to(array[new.employee_id], coalesce(what, 'Check') || ' sent back', coalesce(nullif(new.review_note, ''), 'Please upload a new document.'), '/profile');
  end if;
  return new;
end;
$$;
drop trigger if exists employee_checks_push on public.employee_checks;
create trigger employee_checks_push after update of status on public.employee_checks
  for each row execute function public.push_check_reviewed();

-- ── Every morning ────────────────────────────────────────────────────────
create or replace function public.push_daily_reminders()
returns void language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Australia/Sydney')::date;
  r record;
begin
  -- Checklists from yesterday not submitted: expired, but can still be done.
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
end;
$$;
revoke execute on function public.push_daily_reminders() from public, anon, authenticated;

select cron.unschedule('push-daily-reminders') where exists (select 1 from cron.job where jobname = 'push-daily-reminders');
select cron.schedule('push-daily-reminders', '0 21 * * *', $$ select public.push_daily_reminders(); $$);
