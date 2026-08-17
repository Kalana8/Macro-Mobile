-- Per-day checklist content — a template's Visit Schedule is an explicit
-- list of calendar dates (visit_dates), but the content for a given date is
-- resolved by which weekday it falls on, so the admin only has to enter
-- Monday's checklist once and every date that lands on a Monday
-- automatically reuses it (still editable any time). day_areas is keyed by
-- day-of-week string ("0"=Sun.."6"=Sat). `areas` stays as a legacy fallback
-- column (used only if a date's weekday has no entry yet in day_areas).

alter table checklist_templates add column if not exists day_areas jsonb not null default '{}';

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
    coalesce(ct.day_areas -> today_dow::text, ct.areas),
    ct.special_note,
    'pending',
    ca.admin_note
  from checklist_assignments ca
  join checklist_templates ct on ct.id = ca.template_id
  join sites s on s.id = ct.site_id
  where today = any(ct.visit_dates)
    and not exists (
      select 1 from checklists existing
      where existing.template_id = ca.template_id
        and existing.employee_id = ca.employee_id
        and existing.assigned_date = today
    );
end;
$$;
