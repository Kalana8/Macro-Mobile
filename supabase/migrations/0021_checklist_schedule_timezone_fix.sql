-- Supabase's database runs in UTC, but visit_time is set by admins
-- thinking in Australian (Sydney/Melbourne/Brisbane) local time — comparing
-- it against raw now()::time / current_date meant a company set to send at
-- "9:00 AM" actually fired at 9:00 AM UTC (7-8 PM local, depending on
-- daylight saving), so checklists effectively never arrived when expected.
-- Convert to Australia/Sydney wall-clock time before comparing.
create or replace function generate_due_checklists()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  local_now timestamp := now() at time zone 'Australia/Sydney';
  today_dow int := extract(dow from local_now);
  today date := local_now::date;
  local_time time := local_now::time;
begin
  insert into checklists (template_id, company_id, site, employee_id, assigned_date, areas, status, admin_note)
  select
    ca.template_id,
    ca.company_id,
    ct.site,
    ca.employee_id,
    today,
    ct.areas,
    'pending',
    ca.admin_note
  from checklist_assignments ca
  join checklist_templates ct on ct.id = ca.template_id
  join companies c on c.id = ca.company_id
  where c.visit_time is not null
    and local_time >= c.visit_time
    and local_time < c.visit_time + interval '15 minutes'
    and (
      (
        c.visit_frequency = 'weekly'
        and today_dow = any(c.visit_days)
        and (c.visit_start_date is null or today >= c.visit_start_date)
        and (c.visit_end_date is null or today <= c.visit_end_date)
      )
      or (
        c.visit_frequency = 'fortnightly'
        and today_dow = any(c.visit_days)
        and c.visit_start_date is not null
        and today >= c.visit_start_date
        and (c.visit_end_date is null or today <= c.visit_end_date)
        and ((today - c.visit_start_date) / 7) % 2 = 0
      )
      or (
        c.visit_frequency = 'custom'
        and c.visit_start_date is not null
        and c.visit_end_date is not null
        and today between c.visit_start_date and c.visit_end_date
      )
    )
    and not exists (
      select 1 from checklists existing
      where existing.template_id = ca.template_id
        and existing.employee_id = ca.employee_id
        and existing.assigned_date = today
    );
end;
$$;
