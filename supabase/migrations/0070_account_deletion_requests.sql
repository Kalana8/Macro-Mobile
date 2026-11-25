-- Account deletion requests, from the "Delete account" page on the Macro
-- website (macropropertyservices.com.au/delete-account), which the app's
-- Profile → Delete Account opens. Google Play requires a web page where
-- people can ask for their account and data to be deleted.
--
-- Anyone can send a request (the page has no sign-in): they can only add a
-- new request, never read, change or delete one. Admins see them on the
-- dashboard's Delete Account Requests page and mark them done once the
-- account is deleted.

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  username text not null check (length(trim(username)) between 3 and 200),
  requested_on date not null,
  reason text not null default '' check (length(reason) <= 2000),
  status text not null default 'new' check (status in ('new', 'done')),
  handled_by uuid references public.employees(id) on delete set null,
  handled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists account_deletion_requests_created_idx on public.account_deletion_requests(created_at desc);

alter table public.account_deletion_requests enable row level security;

drop policy if exists account_deletion_requests_submit on public.account_deletion_requests;
create policy account_deletion_requests_submit on public.account_deletion_requests for insert to anon, authenticated
  with check (status = 'new' and handled_by is null and handled_at is null);

drop policy if exists account_deletion_requests_admin_all on public.account_deletion_requests;
create policy account_deletion_requests_admin_all on public.account_deletion_requests for all to authenticated
  using (is_admin()) with check (is_admin());

-- Only adding is open to visitors; reading and changing stay admin-only.
revoke all on public.account_deletion_requests from anon;
grant insert on public.account_deletion_requests to anon;
grant select, insert, update, delete on public.account_deletion_requests to authenticated;
