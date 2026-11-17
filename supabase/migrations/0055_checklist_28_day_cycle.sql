-- Checklist templates on a 28-day cycle (4 weeks, Monday to Sunday) instead
-- of hand-picked calendar dates. Every subtask has its own frequency:
--   daily   - all 28 days
--   weekly  - one weekday in each of the 4 weeks
--   monthly - one day in the 28 (e.g. Week 1 Monday)
--   custom  - any days ticked on the 4-week grid
-- The subtask stores the resolved cycle days (0-27; 0 = Week 1 Monday,
-- 27 = Week 4 Sunday) in `days`, plus `frequency` (and `weekday`/`week`) so
-- the editor can show what was chosen.
--
-- cycle_start is the Monday Week 1 begins. After 28 days the cycle repeats
-- (cycle_repeats) or stops. cycle_end, when set, is the last day anything is
-- sent ("End now").
--
-- Templates made before this keep working: without cycle_start they still use
-- visit_dates + day_areas.

alter table public.checklist_templates
  add column if not exists cycle_start date,
  add column if not exists cycle_repeats boolean not null default true,
  add column if not exists cycle_end date,
  add column if not exists cycle_areas jsonb not null default '[]';

/**
 * The checklist content a template sends on a date: its main areas, each
 * with only the subtasks that fall on that day. Null when nothing is due.
 */
create or replace function public.checklist_areas_on(t public.checklist_templates, d date)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  idx int;
  result jsonb;
begin
  if t.cycle_start is not null then
    idx := d - t.cycle_start;
    if idx < 0 then return null; end if;
    if t.cycle_end is not null and d > t.cycle_end then return null; end if;
    if not t.cycle_repeats and idx >= 28 then return null; end if;
    idx := idx % 28;
    select jsonb_agg(q.area_out order by q.ord) into result
      from (
        select a.ord, jsonb_set(a.area, '{subtasks}', x.subs) as area_out
          from jsonb_array_elements(t.cycle_areas) with ordinality as a(area, ord)
          cross join lateral (
            select coalesce(jsonb_agg(s.sub - 'days' - 'frequency' - 'weekday' - 'week' order by s.sord), '[]'::jsonb) as subs
              from jsonb_array_elements(coalesce(a.area -> 'subtasks', '[]'::jsonb)) with ordinality as s(sub, sord)
             where coalesce(s.sub -> 'days', '[]'::jsonb) @> to_jsonb(idx)
          ) x
         where jsonb_array_length(x.subs) > 0
      ) q;
    return result;
  end if;

  if d = any(t.visit_dates) then
    return coalesce(t.day_areas -> (extract(dow from d)::int)::text, t.areas);
  end if;
  return null;
end;
$$;

revoke execute on function public.checklist_areas_on(public.checklist_templates, date) from public, anon;
grant execute on function public.checklist_areas_on(public.checklist_templates, date) to authenticated;

-- The scheduled job: each assigned employee gets today's checklist when the
-- template has something due today, once per day.
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
    x.areas,
    ct.special_note,
    'pending',
    ca.admin_note
  from checklist_assignments ca
  join checklist_templates ct on ct.id = ca.template_id
  join sites s on s.id = ct.site_id
  cross join lateral (select public.checklist_areas_on(ct, today) as areas) x
  where x.areas is not null
    and jsonb_array_length(x.areas) > 0
    and not exists (
      select 1 from checklists existing
      where existing.template_id = ca.template_id
        and existing.employee_id = ca.employee_id
        and existing.assigned_date = today
    );
end;
$$;
