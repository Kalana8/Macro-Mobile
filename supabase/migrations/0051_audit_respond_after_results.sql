-- Employees check and respond to audits after the admin has sent the results
-- (status 'complete'), not only before. 0050 closed an audit to the employee
-- once it was complete; now it closes only once the employee has submitted
-- their note and photos.

create or replace function public.audits_guard_employee_update()
returns trigger language plpgsql set search_path = public as $$
begin
  if public.is_admin() then
    return new;
  end if;
  if old.employee_submitted_at is not null then
    raise exception 'This audit has already been submitted.' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'employee_verified_at' - 'employee_note' - 'employee_images' - 'employee_submitted_at')
     is distinct from (to_jsonb(old) - 'employee_verified_at' - 'employee_note' - 'employee_images' - 'employee_submitted_at') then
    raise exception 'Audits are view only. You can mark one as checked, or add a note and photos.' using errcode = '42501';
  end if;
  -- Photos must be the employee's own uploads in the private audit-images bucket.
  if exists (select 1 from unnest(new.employee_images) p where p not like auth.uid()::text || '/%') then
    raise exception 'Invalid audit photos.' using errcode = '22023';
  end if;
  -- The server, not the phone, records when. Checked stays checked; submitting also counts as checked.
  if old.employee_verified_at is not null then
    new.employee_verified_at := old.employee_verified_at;
  elsif new.employee_verified_at is not null or new.employee_submitted_at is not null then
    new.employee_verified_at := now();
  end if;
  if new.employee_submitted_at is not null then
    new.employee_submitted_at := now();
  end if;
  return new;
end;
$$;

drop policy if exists audits_assignee_update on public.audits;
create policy audits_assignee_update on public.audits for update
  using (employee_id = auth.uid() and employee_submitted_at is null)
  with check (employee_id = auth.uid());
