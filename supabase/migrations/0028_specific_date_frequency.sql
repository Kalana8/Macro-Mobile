-- Adds a fourth visit-schedule mode: "specific_date". It's the same
-- day-of-week + date-window shape as "weekly", except Start Date and End
-- Date are both required (enforced in the admin UI) rather than optional —
-- for a short, bounded window on a specific day rather than an open-ended
-- weekly recurrence. generate_due_checklists() treats it identically to
-- 'weekly' since the underlying rule (fire on the selected weekday, within
-- whatever date bounds are set) is the same either way.

alter table sites drop constraint if exists sites_visit_frequency_check;
alter table sites add constraint sites_visit_frequency_check
  check (visit_frequency in ('weekly', 'fortnightly', 'custom', 'specific_date'));

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
  insert into checklists (template_id, company_id, site, site_id, employee_id, assigned_date, areas, status, admin_note)
  select
    ca.template_id,
    ca.company_id,
    s.name,
    s.id,
    ca.employee_id,
    today,
    ct.areas,
    'pending',
    ca.admin_note
  from checklist_assignments ca
  join checklist_templates ct on ct.id = ca.template_id
  join sites s on s.id = ct.site_id
  where (
      (
        s.visit_frequency in ('weekly', 'specific_date')
        and today_dow = any(s.visit_days)
        and (s.visit_start_date is null or today >= s.visit_start_date)
        and (s.visit_end_date is null or today <= s.visit_end_date)
      )
      or (
        s.visit_frequency = 'fortnightly'
        and today_dow = any(s.visit_days)
        and s.visit_start_date is not null
        and today >= s.visit_start_date
        and (s.visit_end_date is null or today <= s.visit_end_date)
        and ((today - s.visit_start_date) / 7) % 2 = 0
      )
      or (
        s.visit_frequency = 'custom'
        and s.visit_start_date is not null
        and s.visit_end_date is not null
        and today between s.visit_start_date and s.visit_end_date
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
