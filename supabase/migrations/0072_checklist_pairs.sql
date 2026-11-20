-- Paired checklists, and editing after submitting.
--
-- Pairs: on the dashboard (Checklists → Assign), two employees with the same
-- checklist can be paired. Each still gets their own copy every day, but
-- when one of them submits it, the other's copy for that day is submitted
-- too, with the same ticks, notes and photos, and shows who submitted it.
--
-- Editing: whoever's checklist it is can change a submitted checklist (tick
-- again, add photos, change the note). Changes reach the pair's copy too.
--
-- checklist_assignments.pair_id: assignments of one checklist sharing a
-- pair_id are paired. checklists.pair_id is copied from the assignment.

alter table public.checklist_assignments add column if not exists pair_id uuid;
alter table public.checklists add column if not exists pair_id uuid;
-- No foreign key on purpose: a second link from checklists to employees would
-- make the existing employees(full_name) lookups ambiguous in app builds
-- already on phones. Names come from checklist_pair() and the dashboard.
alter table public.checklists add column if not exists submitted_by uuid;
alter table public.checklists add column if not exists edited_at timestamptz;
create index if not exists checklists_pair_idx on public.checklists(pair_id, assigned_date) where pair_id is not null;

-- Existing submitted checklists were submitted by their own employee.
update public.checklists set submitted_by = employee_id where status = 'submitted' and submitted_by is null;

-- A new day's copy takes its assignment's pair.
create or replace function public.checklists_take_pair()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.template_id is not null and new.employee_id is not null and new.pair_id is null then
    select a.pair_id into new.pair_id from checklist_assignments a
     where a.template_id = new.template_id and a.employee_id = new.employee_id;
  end if;
  return new;
end;
$$;
drop trigger if exists checklists_take_pair on public.checklists;
create trigger checklists_take_pair before insert on public.checklists
  for each row execute function public.checklists_take_pair();

-- Pairing or unpairing on the dashboard reaches the copies still to do.
create or replace function public.checklist_assignments_share_pair()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update checklists set pair_id = new.pair_id
   where template_id = new.template_id and employee_id = new.employee_id
     and status = 'pending' and pair_id is distinct from new.pair_id;
  return new;
end;
$$;
drop trigger if exists checklist_assignments_share_pair on public.checklist_assignments;
create trigger checklist_assignments_share_pair after update of pair_id on public.checklist_assignments
  for each row execute function public.checklist_assignments_share_pair();

-- Who submitted it: set by the database, never taken from the app.
create or replace function public.checklists_mark_submitter()
returns trigger language plpgsql set search_path = public as $$
begin
  if pg_trigger_depth() > 1 then
    return new; -- the pair's copy, written below
  end if;
  if new.status = 'submitted' then
    if old.status is distinct from 'submitted' then
      new.submitted_by := coalesce(auth.uid(), new.employee_id);
    elsif new.areas is distinct from old.areas or new.notes is distinct from old.notes or new.images is distinct from old.images then
      new.edited_at := now();
      new.submitted_by := coalesce(auth.uid(), old.submitted_by);
    else
      new.submitted_by := old.submitted_by;
    end if;
  else
    new.submitted_by := null;
  end if;
  -- Only admins change pairs.
  if new.pair_id is distinct from old.pair_id and auth.uid() is not null and not public.is_admin() then
    new.pair_id := old.pair_id;
  end if;
  return new;
end;
$$;
drop trigger if exists checklists_mark_submitter on public.checklists;
create trigger checklists_mark_submitter before update on public.checklists
  for each row execute function public.checklists_mark_submitter();

-- Submitting (or editing) one copy fills in the pair's copy for the same day.
create or replace function public.checklists_share_with_pair()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 or new.pair_id is null or new.status <> 'submitted' then
    return new;
  end if;
  if old.status = 'submitted' and new.areas is not distinct from old.areas
     and new.notes is not distinct from old.notes and new.images is not distinct from old.images then
    return new;
  end if;
  update checklists c
     set areas = new.areas, notes = new.notes, images = new.images, status = 'submitted',
         submitted_at = coalesce(c.submitted_at, new.submitted_at), submitted_by = new.submitted_by,
         edited_at = case when c.status = 'submitted' then now() else c.edited_at end
   where c.pair_id = new.pair_id and c.assigned_date = new.assigned_date
     and c.template_id is not distinct from new.template_id and c.id <> new.id;
  return new;
end;
$$;
drop trigger if exists checklists_share_with_pair on public.checklists;
create trigger checklists_share_with_pair after update on public.checklists
  for each row execute function public.checklists_share_with_pair();

-- The other person on a checklist's pair, for the app ("Paired with …").
create or replace function public.checklist_pair(checklist_id uuid)
returns table (employee_id uuid, full_name text, status text)
language sql stable security definer set search_path = public as $$
  select o.employee_id, e.full_name, o.status::text
    from checklists c
    join checklists o on o.pair_id = c.pair_id and o.assigned_date = c.assigned_date
                     and o.template_id is not distinct from c.template_id and o.id <> c.id
    join employees e on e.id = o.employee_id
   where c.id = checklist_id and c.pair_id is not null
     and (c.employee_id = auth.uid() or public.is_admin()
          or c.company_id in (select public.user_company_ids()));
$$;
revoke execute on function public.checklist_pair(uuid) from public, anon;
grant execute on function public.checklist_pair(uuid) to authenticated;

-- Pushes: the pair hears their checklist was submitted for them; reviewers
-- and clients hear once per pair, not twice.
create or replace function public.push_checklists()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  staff uuid[];
  clients uuid[];
  who text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' and new.employee_id is not null then
    perform push_to(array[new.employee_id], 'New checklist', push_place(new.company_id, new.site), '/checklist/' || new.id);
  elsif tg_op = 'UPDATE' and new.status = 'submitted' and old.status is distinct from 'submitted' then
    if new.submitted_by is not null and new.submitted_by is distinct from new.employee_id then
      select full_name into who from employees where id = new.submitted_by;
      perform push_to(array[new.employee_id], 'Checklist submitted by your pair',
        concat_ws(' · ', who, push_place(new.company_id, new.site)), '/checklist/' || new.id);
      return new;
    end if;
    select full_name into who from employees where id = new.employee_id;
    select array_agg(distinct e.id) filter (where not sees_initials_only(e.id)),
           array_agg(distinct e.id) filter (where sees_initials_only(e.id))
      into staff, clients
      from employees e
      join employee_companies ec on ec.employee_id = e.id and ec.company_id = new.company_id
      join roles r on r.id = e.access_role_id
     where coalesce((r.permissions -> 'app' -> 'checklists' ->> 'reviewAll')::boolean, false)
       and e.id is distinct from new.employee_id
       and e.status = 'active';
    perform push_to(staff, 'Checklist submitted', concat_ws(' · ', who, push_place(new.company_id, new.site)), '/checklist/' || new.id);
    perform push_to(clients, 'Checklist submitted', concat_ws(' · ', initials_of(who), push_place(new.company_id, new.site)), '/checklist/' || new.id);
  end if;
  return new;
end;
$$;
