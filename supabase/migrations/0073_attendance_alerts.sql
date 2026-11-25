-- Attendance alerts.
--
-- 1. Left site: while the app is open, a shift clocked in at the site is
--    watched. Two readings in a row clearly outside the site's area clock it
--    out automatically (attendance.left_site), with where the phone was and
--    how far from the site (the clock_out_* columns). The admins get a push.
--
-- 2. Not clocked in: a site can have a "clock in by" hour. At that hour,
--    anyone with a checklist at that site today who hasn't clocked in there
--    yet gets a push, and so do the admins.
--
-- Both are listed on the dashboard's Attendance page (attendance_alerts).

alter table public.attendance add column if not exists left_site boolean not null default false;
alter table public.attendance add column if not exists left_site_at timestamptz;
alter table public.sites add column if not exists clock_in_by smallint check (clock_in_by between 0 and 23);

create table if not exists public.attendance_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('left_site', 'no_clock_in')),
  employee_id uuid not null references public.employees(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  attendance_id uuid references public.attendance(id) on delete cascade,
  date date not null,
  distance_m double precision,
  lat double precision,
  lng double precision,
  address text,
  created_at timestamptz not null default now()
);
create index if not exists attendance_alerts_created_idx on public.attendance_alerts(created_at desc);
-- One "not clocked in" alert per person, site and day.
create unique index if not exists attendance_alerts_no_clock_in_once
  on public.attendance_alerts(employee_id, site_id, date) where kind = 'no_clock_in';

alter table public.attendance_alerts enable row level security;
drop policy if exists attendance_alerts_admin_all on public.attendance_alerts;
create policy attendance_alerts_admin_all on public.attendance_alerts for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists attendance_alerts_self_select on public.attendance_alerts;
create policy attendance_alerts_self_select on public.attendance_alerts for select to authenticated
  using (employee_id = auth.uid());
revoke all on public.attendance_alerts from anon;
grant select on public.attendance_alerts to authenticated;
grant insert, update, delete on public.attendance_alerts to authenticated;

-- Active admins, for pushes.
create or replace function public.admin_ids()
returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(e.id), '{}') from employees e join roles r on r.id = e.access_role_id
   where r.is_admin and e.status = 'active';
$$;
revoke execute on function public.admin_ids() from public, anon, authenticated;

-- A shift marked left_site (set by the app with the clock-out): record it and tell the admins.
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
  end if;
  -- Only the app sets it, once; it can't be cleared by the employee.
  if old.left_site and not new.left_site and not public.is_admin() then
    new.left_site := true;
    new.left_site_at := old.left_site_at;
  end if;
  return new;
end;
$$;
drop trigger if exists attendance_left_site on public.attendance;
create trigger attendance_left_site before update on public.attendance
  for each row execute function public.attendance_left_site();

-- Hourly: people expected at a site today (they have a checklist there) who
-- haven't clocked in there by the site's "clock in by" hour.
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
    end if;
  end loop;
end;
$$;
revoke execute on function public.push_absence_alerts() from public, anon, authenticated;

select cron.unschedule('push-absence-alerts') where exists (select 1 from cron.job where jobname = 'push-absence-alerts');
select cron.schedule('push-absence-alerts', '4 * * * *', 'select public.push_absence_alerts();');
