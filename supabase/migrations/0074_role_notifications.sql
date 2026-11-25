-- Extra push notifications for selected roles, about the people at their sites.
--
-- The usual notifications don't change: "New checklist", "Checklist
-- submitted" to reviewers, "New audit to check", "Audit results", "New
-- photos", "New report", inductions, checks, and the left-site / not
-- clocked in alerts to admins (0073) all work exactly as before.
--
-- On top of those, Roles & Access → Push notifications lets a role switch
-- on alerts about what happens at the sites its people are assigned to
-- (employee_sites):
--   checklistSubmitted  "Devindi Jayasinghe submitted today's checklist · Seoul Garden – Glen Waverly"
--   auditSubmitted      someone at their site submitted an audit (Verified, note and photos)
--   reportSubmitted     someone submitted on a weekly report for their site
--   photosSent          someone sent photos from their site
--   clockInOut          someone clocked in or out at their site
--   messages            a new message in a conversation for their site
--   attendanceAlerts    someone at their site left it while clocked in / didn't clock in on time
--
-- Nobody hears about their own action, and anyone already told by the usual
-- notification isn't told twice. Clients see the person as initials.
-- Nothing is switched on until a role is edited.

-- The people with this switch on who are assigned to the site. Without a
-- site (audits): those who share a site with the person who did it.
create or replace function public.notify_ids(kind text, company uuid, site uuid, actor uuid, skip uuid[] default '{}')
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct e.id), '{}')
    from employees e
    join roles r on r.id = e.access_role_id
   where e.status = 'active'
     and coalesce((r.permissions -> 'notifications' ->> kind)::boolean, false)
     and e.id is distinct from actor
     and not (e.id = any (coalesce(skip, '{}')))
     and case
           when site is not null then exists (select 1 from employee_sites es where es.employee_id = e.id and es.site_id = site)
           else exists (
             select 1 from employee_sites mine
               join employee_sites theirs on theirs.site_id = mine.site_id and theirs.employee_id = actor
               join sites s on s.id = mine.site_id
              where mine.employee_id = e.id and (company is null or s.company_id = company))
         end;
$$;
revoke execute on function public.notify_ids(text, uuid, uuid, uuid, uuid[]) from public, anon, authenticated;

-- Sends one extra alert: the person's full name to staff, initials to clients.
create or replace function public.notify_role(kind text, company uuid, site uuid, actor uuid, title text, body_after_name text, href text, skip uuid[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  who text;
  ids uuid[] := notify_ids(kind, company, site, actor, skip);
  staff uuid[];
  clients uuid[];
begin
  if cardinality(ids) = 0 then return; end if;
  select full_name into who from employees where id = actor;
  select array_agg(i) filter (where not sees_initials_only(i)), array_agg(i) filter (where sees_initials_only(i))
    into staff, clients from unnest(ids) as i;
  perform push_to(staff, title, concat_ws(' ', coalesce(who, 'Someone'), body_after_name), href);
  perform push_to(clients, title, concat_ws(' ', coalesce(initials_of(who), 'Someone'), body_after_name), href);
end;
$$;
revoke execute on function public.notify_role(text, uuid, uuid, uuid, text, text, text, uuid[]) from public, anon, authenticated;

-- Checklists: exactly as before (0072), plus the extra alert for selected roles.
create or replace function public.push_checklists()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  staff uuid[];
  clients uuid[];
  who text;
  local_today date := (now() at time zone 'Australia/Sydney')::date;
begin
  if tg_op = 'INSERT' and new.status = 'pending' and new.employee_id is not null then
    perform push_to(array[new.employee_id], 'New checklist', push_place(new.company_id, new.site), '/checklist/' || new.id);
  elsif tg_op = 'UPDATE' and new.status = 'submitted' and old.status is distinct from 'submitted' then
    if new.submitted_by is not null and new.submitted_by is distinct from new.employee_id then
      select full_name into who from employees where id = new.submitted_by;
      perform push_to(array[new.employee_id], 'Checklist submitted by your pair',
        concat_ws(' · ', who, push_place(new.company_id, new.site)), '/checklist/' || new.id);
      return new;
    end if;
    select full_name into who from employees where id = new.employee_id;
    select array_agg(distinct e.id) filter (where not sees_initials_only(e.id)),
           array_agg(distinct e.id) filter (where sees_initials_only(e.id))
      into staff, clients
      from employees e
      join employee_companies ec on ec.employee_id = e.id and ec.company_id = new.company_id
      join roles r on r.id = e.access_role_id
     where coalesce((r.permissions -> 'app' -> 'checklists' ->> 'reviewAll')::boolean, false)
       and e.id is distinct from new.employee_id
       and e.status = 'active';
    perform push_to(staff, 'Checklist submitted', concat_ws(' · ', who, push_place(new.company_id, new.site)), '/checklist/' || new.id);
    perform push_to(clients, 'Checklist submitted', concat_ws(' · ', initials_of(who), push_place(new.company_id, new.site)), '/checklist/' || new.id);
    -- Extra: selected roles at this site (not those just told above).
    perform notify_role('checklistSubmitted', new.company_id, new.site_id, new.employee_id, 'Checklist submitted',
      case when new.assigned_date = local_today then 'submitted today''s checklist' else 'submitted the ' || to_char(new.assigned_date, 'DD Mon') || ' checklist' end
        || ' · ' || push_place(new.company_id, new.site),
      '/checklist/' || new.id,
      coalesce(staff, '{}') || coalesce(clients, '{}'));
  end if;
  return new;
end;
$$;

-- Audits: exactly as before, plus the extra alert when someone submits one.
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
  if tg_op = 'UPDATE' and new.employee_submitted_at is not null and old.employee_submitted_at is null then
    perform notify_role('auditSubmitted', new.company_id, null, new.employee_id, 'Audit submitted',
      'submitted ' || coalesce(nullif(new.title, ''), 'an audit'), '/audits/' || new.id);
  end if;
  return new;
end;
$$;

-- Reports: someone submitted their note and photos on a weekly report.
create or replace function public.push_report_submitted()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  company uuid;
  site uuid;
  what text;
begin
  if new.submitted_at is not null and old.submitted_at is null then
    select w.company_id, w.site_id, concat_ws(' · ', 'Week ' || w.report_number, nullif(w.title, '')) into company, site, what
      from weekly_reports w where w.id = new.report_id;
    perform notify_role('reportSubmitted', company, site, new.employee_id, 'Report submitted',
      'submitted ' || coalesce(what, 'a report'), '/reports/' || new.report_id);
  end if;
  return new;
end;
$$;
drop trigger if exists weekly_report_recipients_submitted_push on public.weekly_report_recipients;
create trigger weekly_report_recipients_submitted_push after update of submitted_at on public.weekly_report_recipients
  for each row execute function public.push_report_submitted();

-- Photos: someone sent photos from a site. Runs once the send is saved (the
-- recipients are in by then) and skips them: they already get "New photos".
create or replace function public.push_photos_sent()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n int := cardinality(new.images);
  told uuid[];
begin
  select coalesce(array_agg(r.recipient_id), '{}') into told from photo_share_recipients r where r.share_id = new.id;
  perform notify_role('photosSent', new.company_id, new.site_id, new.sender_id, 'Photos sent',
    'sent ' || n || ' photo' || case when n = 1 then '' else 's' end
      || coalesce(' · ' || push_place(new.company_id, (select name from sites where id = new.site_id)), ''),
    '/photos', told);
  return new;
end;
$$;
drop trigger if exists photo_shares_sent_push on public.photo_shares;
create constraint trigger photo_shares_sent_push after insert on public.photo_shares
  deferrable initially deferred
  for each row execute function public.push_photos_sent();

-- Clock in / clock out at a site.
create or replace function public.push_clock()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  place text := push_place(new.company_id, (select name from sites where id = new.site_id));
begin
  if tg_op = 'INSERT' and new.clock_in_at is not null then
    perform notify_role('clockInOut', new.company_id, new.site_id, new.employee_id, 'Clocked in',
      'clocked in · ' || place || ' · ' || to_char(new.clock_in_at at time zone 'Australia/Sydney', 'FMHH12:MI am'), '/attendance');
  elsif tg_op = 'UPDATE' and new.clock_out_at is not null and old.clock_out_at is null and not new.left_site then
    -- Leaving the site has its own alert (attendanceAlerts).
    perform notify_role('clockInOut', new.company_id, new.site_id, new.employee_id, 'Clocked out',
      'clocked out · ' || place || ' · ' || to_char(new.clock_out_at at time zone 'Australia/Sydney', 'FMHH12:MI am'), '/attendance');
  end if;
  return new;
end;
$$;
drop trigger if exists attendance_clock_push on public.attendance;
create trigger attendance_clock_push after insert or update of clock_out_at on public.attendance
  for each row execute function public.push_clock();

-- Messages: a new message in a conversation for a site ("Jo: Use the rear lift").
create or replace function public.push_message()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  ids uuid[];
begin
  if new.last_message_at is distinct from old.last_message_at and new.last_message_at is not null and new.site_id is not null then
    ids := notify_ids('messages', new.company_id, new.site_id, auth.uid());
    perform push_to(ids, 'New message · ' || coalesce(nullif(new.title, ''), 'Conversation'),
      coalesce(nullif(new.last_update, ''), 'New message'), '/chat/' || new.id);
  end if;
  return new;
end;
$$;
drop trigger if exists communications_message_push on public.communications;
create trigger communications_message_push after update of last_message_at on public.communications
  for each row execute function public.push_message();

-- Left site (0073): admins as before, plus selected roles at that site.
create or replace function public.attendance_left_site()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  who text;
begin
  if new.left_site and not coalesce(old.left_site, false) then
    new.left_site_at := coalesce(new.left_site_at, now());
    insert into attendance_alerts (kind, employee_id, company_id, site_id, attendance_id, date, distance_m, lat, lng, address)
    values ('left_site', new.employee_id, new.company_id, new.site_id, new.id,
            (new.left_site_at at time zone 'Australia/Sydney')::date,
            new.clock_out_distance, new.clock_out_lat, new.clock_out_lng, new.clock_out_address);
    select full_name into who from employees where id = new.employee_id;
    perform push_to(admin_ids(), 'Left site · clocked out',
      concat_ws(' · ', who, push_place(new.company_id, (select name from sites where id = new.site_id)),
                case when new.clock_out_distance is not null then round(new.clock_out_distance)::text || ' m away' end),
      '/attendance');
    perform notify_role('attendanceAlerts', new.company_id, new.site_id, new.employee_id, 'Left site · clocked out',
      'left ' || push_place(new.company_id, (select name from sites where id = new.site_id))
        || case when new.clock_out_distance is not null then ' · ' || round(new.clock_out_distance)::text || ' m away' else '' end,
      '/attendance', admin_ids());
  end if;
  if old.left_site and not new.left_site and not public.is_admin() then
    new.left_site := true;
    new.left_site_at := old.left_site_at;
  end if;
  return new;
end;
$$;

-- Not clocked in (0073): the person and admins as before, plus selected roles at that site.
create or replace function public.push_absence_alerts()
returns void language plpgsql security definer set search_path = public as $$
declare
  local_now timestamp := now() at time zone 'Australia/Sydney';
  today date := local_now::date;
  hour int := extract(hour from local_now);
  r record;
begin
  for r in
    select distinct c.employee_id, s.id as site_id, s.company_id, s.name as site_name, e.full_name
      from sites s
      join checklists c on c.site_id = s.id and c.assigned_date = today and c.employee_id is not null
      join employees e on e.id = c.employee_id and e.status = 'active'
     where s.clock_in_by = hour
       and not exists (
         select 1 from attendance a
          where a.employee_id = c.employee_id and a.site_id = s.id
            and (a.clock_in_at at time zone 'Australia/Sydney')::date = today)
  loop
    insert into attendance_alerts (kind, employee_id, company_id, site_id, date)
    values ('no_clock_in', r.employee_id, r.company_id, r.site_id, today)
    on conflict do nothing;
    if found then
      perform push_to(array[r.employee_id], 'You haven''t clocked in',
        push_place(r.company_id, r.site_name) || ' · clock in when you arrive', '/clock');
      perform push_to(admin_ids(), 'Not clocked in',
        concat_ws(' · ', r.full_name, push_place(r.company_id, r.site_name)), '/attendance');
      perform notify_role('attendanceAlerts', r.company_id, r.site_id, r.employee_id, 'Not clocked in',
        'hasn''t clocked in · ' || push_place(r.company_id, r.site_name), '/attendance', admin_ids());
    end if;
  end loop;
end;
$$;
