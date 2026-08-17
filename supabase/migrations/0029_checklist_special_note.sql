-- "Special Notes" — a checklist-level field distinct from each area's own
-- note, meant for a one-off instruction tied to a "Specific Date" scheduled
-- site's visit window. Set on the template, copied into every generated
-- checklist instance (same snapshot pattern as `areas`/`site`), and
-- displayed to the employee as a highlighted "Specific Task" callout.

alter table checklist_templates add column if not exists special_note text;
alter table checklists add column if not exists special_note text;

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
  insert into checklists (template_id, company_id, site, site_id, employee_id, assigned_date, areas, special_note, status, admin_note)
  select
    ca.template_id,
    ca.company_id,
    s.name,
    s.id,
    ca.employee_id,
    today,
    ct.areas,
    ct.special_note,
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
