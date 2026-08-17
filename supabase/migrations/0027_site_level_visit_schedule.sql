-- Visit scheduling moves from Company down to Site — every Site under a
-- Company can now have its own recurring schedule instead of all sites
-- sharing one company-wide schedule. Checklist templates (and the checklist
-- instances generated from them) also get a real `site_id` foreign key
-- instead of matching on the free-text `site` name column.

-- ---------------------------------------------------------------------------
-- 1. Add schedule columns to sites (same shape as companies had)
-- ---------------------------------------------------------------------------
alter table sites add column if not exists visit_frequency text not null default 'weekly';
alter table sites add column if not exists visit_days smallint[] not null default '{}';
alter table sites add column if not exists visit_start_date date;
alter table sites add column if not exists visit_end_date date;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'sites_visit_frequency_check'
  ) then
    alter table sites add constraint sites_visit_frequency_check
      check (visit_frequency in ('weekly', 'fortnightly', 'custom'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Backfill each site's schedule from its parent company's current values
-- ---------------------------------------------------------------------------
update sites s
set visit_frequency = c.visit_frequency,
    visit_days = c.visit_days,
    visit_start_date = c.visit_start_date,
    visit_end_date = c.visit_end_date
from companies c
where c.id = s.company_id;

-- ---------------------------------------------------------------------------
-- 3. Drop the now-unused schedule columns from companies
-- ---------------------------------------------------------------------------
alter table companies drop constraint if exists companies_visit_frequency_check;
alter table companies drop column if exists visit_frequency;
alter table companies drop column if exists visit_days;
alter table companies drop column if exists visit_time;
alter table companies drop column if exists visit_start_date;
alter table companies drop column if exists visit_end_date;

-- ---------------------------------------------------------------------------
-- 4. Link checklist_templates to a real site (replacing free-text matching)
-- ---------------------------------------------------------------------------
alter table checklist_templates add column if not exists site_id uuid references sites(id) on delete cascade;

update checklist_templates ct
set site_id = s.id
from sites s
where s.company_id = ct.company_id
  and lower(trim(s.name)) = lower(trim(ct.site))
  and ct.site_id is null;

alter table checklist_templates alter column site_id set not null;
alter table checklist_templates drop column site;

-- ---------------------------------------------------------------------------
-- 5. Link checklists to a site too (site name text column stays as a
--    point-in-time snapshot, same pattern as the deep-copied `areas`)
-- ---------------------------------------------------------------------------
alter table checklists add column if not exists site_id uuid references sites(id) on delete set null;

update checklists c
set site_id = s.id
from sites s
where s.company_id = c.company_id
  and lower(trim(s.name)) = lower(trim(c.site))
  and c.site_id is null;

-- ---------------------------------------------------------------------------
-- 6. Rewrite generate_due_checklists() to read the schedule off the site
--    (via checklist_templates.site_id) instead of the company.
-- ---------------------------------------------------------------------------
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
        s.visit_frequency = 'weekly'
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
