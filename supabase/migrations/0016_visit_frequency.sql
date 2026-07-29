-- Companies previously only had a weekday set (visit_days) + a time of
-- day. Add a frequency dimension — weekly (unchanged), fortnightly
-- (weekday set + an anchor start date, fires every other matching week),
-- and custom (an explicit start/end date range, fires every day in range,
-- no weekday filtering) — so admins can express biweekly/one-off-range
-- visit schedules, not just "every week on these days".
alter table companies add column if not exists visit_frequency text not null default 'weekly';
alter table companies add column if not exists visit_start_date date;
alter table companies add column if not exists visit_end_date date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'companies_visit_frequency_check'
  ) then
    alter table companies add constraint companies_visit_frequency_check
      check (visit_frequency in ('weekly', 'fortnightly', 'custom'));
  end if;
end $$;

create or replace function generate_due_checklists()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  today_dow int := extract(dow from current_date);
  today date := current_date;
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
    and now()::time >= c.visit_time
    and now()::time < c.visit_time + interval '15 minutes'
    and (
      (c.visit_frequency = 'weekly' and today_dow = any(c.visit_days))
      or (
        c.visit_frequency = 'fortnightly'
        and today_dow = any(c.visit_days)
        and c.visit_start_date is not null
        and today >= c.visit_start_date
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
