-- Lets an admin decide, per audit, whether the assigned employee may only view
-- it or fill it in from the app (rate each item, comment, add photos, submit).
-- Once the employee submits, the audit locks for them and goes back to the
-- admin for marks, exactly as before.
--
-- Employees can only ever change answers: a trigger refuses any change to the
-- questions, marks, status, access or anything else, and refuses all changes
-- after they have submitted.

alter table public.audits add column if not exists employee_access text not null default 'view'
  check (employee_access in ('view', 'edit'));
alter table public.audits add column if not exists employee_submitted_at timestamptz;

/** The parts of main_audits only an admin may change: sections, their marks, and the items' wording. */
create or replace function public.audit_structure(sections jsonb)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m->'id', 'title', m->'title', 'marks', m->'marks',
    'items', (select coalesce(jsonb_agg(jsonb_build_object('id', s->'id', 'text', s->'text') order by si), '[]'::jsonb)
              from jsonb_array_elements(coalesce(m->'sub_audits', '[]'::jsonb)) with ordinality x(s, si))
  ) order by mi), '[]'::jsonb)
  from jsonb_array_elements(coalesce(sections, '[]'::jsonb)) with ordinality y(m, mi);
$$;

create or replace function public.audits_guard_employee_update()
returns trigger language plpgsql set search_path = public as $$
declare
  section jsonb;
begin
  if public.is_admin() then
    return new;
  end if;
  if old.employee_submitted_at is not null or old.status = 'complete' then
    raise exception 'This audit has already been submitted.' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'main_audits' - 'employee_submitted_at') is distinct from (to_jsonb(old) - 'main_audits' - 'employee_submitted_at') then
    raise exception 'Only answers can be changed on an audit.' using errcode = '42501';
  end if;
  if public.audit_structure(new.main_audits) is distinct from public.audit_structure(old.main_audits) then
    raise exception 'The audit questions can only be changed by an admin.' using errcode = '42501';
  end if;
  for section in select * from jsonb_array_elements(new.main_audits) loop
    if jsonb_array_length(coalesce(section->'images', '[]'::jsonb)) > 10
       or exists (select 1 from jsonb_array_elements(coalesce(section->'sub_audits', '[]'::jsonb)) s
                  where coalesce(s->>'result', '') not in ('', 'good', 'satisfactory', 'not_satisfactory'))
       or char_length(coalesce(section->>'comment', '')) > 2000 then
      raise exception 'Invalid audit answers.' using errcode = '22023';
    end if;
  end loop;
  -- The server, not the phone, records when it was submitted.
  if new.employee_submitted_at is not null then
    new.employee_submitted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists audits_guard_employee_update on public.audits;
create trigger audits_guard_employee_update
  before update on public.audits
  for each row execute function public.audits_guard_employee_update();

drop policy if exists audits_assignee_update on public.audits;
create policy audits_assignee_update on public.audits for update
  using (employee_id = auth.uid() and employee_access = 'edit' and employee_submitted_at is null and status <> 'complete')
  with check (employee_id = auth.uid() and employee_access = 'edit');
