-- Clients see staff only as initials ("HF", not "Hashini Fernando"), in push
-- notifications too, matching the app. A client is a role called Client, or
-- one that can neither clock in nor submit checklists (same rule as the app's
-- seesInitialsOnly).

create or replace function public.sees_initials_only(viewer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select lower(btrim(r.name)) = 'client'
        or (not coalesce((r.permissions -> 'app' -> 'attendance' ->> 'clockInOut')::boolean, false)
            and not coalesce((r.permissions -> 'app' -> 'checklists' ->> 'submit')::boolean, false))
      from employees e join roles r on r.id = e.access_role_id
     where e.id = viewer
  ), false);
$$;
revoke execute on function public.sees_initials_only(uuid) from public, anon, authenticated;

/** Two initials: first and last name, or the first two letters of a single name. */
create or replace function public.initials_of(full_name text)
returns text language sql immutable as $$
  select case
    when full_name is null or btrim(full_name) = '' then '?'
    when array_length(regexp_split_to_array(btrim(split_part(full_name, '@', 1)), '[\s._-]+'), 1) = 1
      then upper(left(regexp_replace(split_part(full_name, '@', 1), '[^A-Za-z0-9]', '', 'g'), 2))
    else upper(left((regexp_split_to_array(btrim(split_part(full_name, '@', 1)), '[\s._-]+'))[1], 1)
             || left((regexp_split_to_array(btrim(split_part(full_name, '@', 1)), '[\s._-]+'))[array_length(regexp_split_to_array(btrim(split_part(full_name, '@', 1)), '[\s._-]+'), 1)], 1))
  end;
$$;

-- Photos received: "From HF" for a client.
create or replace function public.push_photos_received()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  sender text;
  n int;
begin
  select e.full_name, cardinality(p.images) into sender, n
    from photo_shares p left join employees e on e.id = p.sender_id where p.id = new.share_id;
  perform push_to(array[new.recipient_id], 'New photos',
    concat_ws(' · ',
      'From ' || case when sees_initials_only(new.recipient_id) then initials_of(sender) else sender end,
      n || ' photo' || case when n = 1 then '' else 's' end),
    '/photos');
  return new;
end;
$$;

-- Checklist submitted: reviewers who are clients get initials.
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
