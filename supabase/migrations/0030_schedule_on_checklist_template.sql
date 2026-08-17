-- Visit scheduling moves from Site down to Checklist Template, as an
-- explicit list of calendar dates — the admin picks exact dates on a 4-week
-- grid (set when creating/editing a checklist on the Checklists page, not
-- when registering a company/site). It's set when creating/editing a
-- checklist on the Checklists page, not when registering a company/site —
-- the earlier "one site can have several rows sharing a name, each with its
-- own schedule" arrangement was a workaround for schedule living on the
-- site; now that a checklist template is what actually needs a schedule
-- (and a site can already have any number of templates), that workaround is
-- no longer necessary, though the ability to reuse a site name is left
-- as-is since it's still occasionally useful.

-- ---------------------------------------------------------------------------
-- 1. Add schedule column to checklist_templates
-- ---------------------------------------------------------------------------
alter table checklist_templates add column if not exists visit_dates date[] not null default '{}';

-- ---------------------------------------------------------------------------
-- 2. Drop the now-unused schedule columns from sites
-- ---------------------------------------------------------------------------
alter table sites drop constraint if exists sites_visit_frequency_check;
alter table sites drop column if exists visit_frequency;
alter table sites drop column if exists visit_days;
alter table sites drop column if exists visit_start_date;
alter table sites drop column if exists visit_end_date;

-- ---------------------------------------------------------------------------
-- 3. Rewrite generate_due_checklists() to fire on the template's own dates
-- ---------------------------------------------------------------------------
create or replace function generate_due_checklists()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  local_now timestamp := now() at time zone 'Australia/Sydney';
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
  where today = any(ct.visit_dates)
    and not exists (
      select 1 from checklists existing
      where existing.template_id = ca.template_id
        and existing.employee_id = ca.employee_id
        and existing.assigned_date = today
    );
end;
$$;
