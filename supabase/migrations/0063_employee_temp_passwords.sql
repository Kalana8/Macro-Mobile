-- The temporary password the office gives a new employee (or sets with
-- "Reset Password") stays viewable on the Employees page until the employee
-- picks their own.
--
-- Only an encrypted copy is kept (AES-256-GCM, key held by the dashboard
-- server, never in the database). The table has no RLS policies, so the app
-- and the public API can't read it at all; only the dashboard's server-side
-- service role can, after checking the person asking is an admin.
--
-- As soon as the employee sets their own password (must_change_password goes
-- false), the stored copy is deleted. Their own password is never kept.

create table if not exists public.employee_temp_passwords (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  secret text not null,
  created_at timestamptz not null default now()
);

alter table public.employee_temp_passwords enable row level security;
revoke all on public.employee_temp_passwords from anon, authenticated;

create or replace function public.forget_temp_password()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.must_change_password is false and old.must_change_password is distinct from false then
    delete from employee_temp_passwords where employee_id = new.id;
  end if;
  return new;
end;
$$;
revoke execute on function public.forget_temp_password() from public, anon, authenticated;

drop trigger if exists employees_forget_temp_password on public.employees;
create trigger employees_forget_temp_password
  after update of must_change_password on public.employees
  for each row execute function public.forget_temp_password();
