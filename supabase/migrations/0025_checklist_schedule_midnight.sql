-- Checklist auto-generation no longer depends on a per-company "Visit
-- Time" — it now fires as soon as possible after midnight (Australia/
-- Sydney) on each of the company's scheduled visit days. The previous
-- design required visit_time to be set or generation silently never ran;
-- removing that dependency avoids that trap entirely. The existing
-- generate-due-checklists cron job already runs every 5 minutes, so this
-- naturally catches the day's checklists within minutes of the date
-- rolling over — and the not-exists dedup guard means it's harmless if the
-- job is ever delayed or runs more than once before generating for a day.

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
  where (
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
