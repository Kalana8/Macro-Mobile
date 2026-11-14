-- Site inductions: an induction added to a site goes to every employee of
-- that site's company, and keeps going to employees added to the company
-- later.
--
-- site_inductions records "this site needs this induction". The dashboard
-- sends it to the company's current employees when it's created; the trigger
-- below sends it to anyone added to the company afterwards. An employee who
-- already has a live or completed invitation for the same site and template
-- is skipped.
--
-- Invitations sent automatically never had a link anyone saw: only a hash of
-- a random value is stored, as for every invitation. The employee opens it
-- from the app (open_my_induction, 0054), which makes a fresh app key.

create table if not exists public.site_inductions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  template_id uuid not null references public.induction_templates(id) on delete cascade,
  expiry_days int not null default 7 check (expiry_days between 1 and 90),
  active boolean not null default true,
  link_base_url text check (link_base_url is null or link_base_url ~ '^https?://[^/\s]+$'),
  created_by uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (site_id, template_id)
);
create index if not exists site_inductions_site_id_idx on public.site_inductions(site_id);

alter table public.site_inductions enable row level security;
drop policy if exists site_inductions_admin_all on public.site_inductions;
create policy site_inductions_admin_all on public.site_inductions for all to authenticated
  using (is_admin()) with check (is_admin());

/** Sends a site's active inductions to one employee of its company, skipping ones they already have. */
create or replace function public.send_site_inductions_to(target_employee uuid, target_company uuid)
returns int
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  si record;
  new_id uuid;
  sent int := 0;
begin
  for si in
    select x.* from site_inductions x
      join sites s on s.id = x.site_id
     where x.active and s.company_id = target_company
  loop
    if exists (
      select 1 from induction_tokens t
       where t.employee_id = target_employee and t.site_id = si.site_id and t.template_id = si.template_id
         and (t.status = 'completed' or (t.status = 'active' and t.expires_at > now()))
    ) then
      continue;
    end if;
    insert into induction_tokens (employee_id, site_id, template_id, token_hash, expires_at, created_by, link_base_url)
    values (
      target_employee, si.site_id, si.template_id,
      encode(digest(encode(gen_random_bytes(32), 'hex'), 'sha256'), 'hex'),
      now() + make_interval(days => si.expiry_days),
      si.created_by, si.link_base_url
    )
    returning id into new_id;
    insert into induction_token_history (token_id, action, new_expires_at, performed_by, note)
    select new_id, 'created', t.expires_at, si.created_by, 'Sent automatically: employee added to the site''s company.'
      from induction_tokens t where t.id = new_id;
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;
revoke execute on function public.send_site_inductions_to(uuid, uuid) from public, anon, authenticated;

create or replace function public.site_inductions_on_new_member()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.send_site_inductions_to(new.employee_id, new.company_id);
  return new;
end;
$$;
revoke execute on function public.site_inductions_on_new_member() from public, anon, authenticated;

drop trigger if exists employee_companies_site_inductions on public.employee_companies;
create trigger employee_companies_site_inductions
  after insert on public.employee_companies
  for each row execute function public.site_inductions_on_new_member();

-- The app shows the company with the site.
drop function if exists public.my_inductions();
create function public.my_inductions()
returns table (id uuid, template_name text, site_name text, company_name text, status text, expires_at timestamptz, submission_status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, coalesce(tpl.name, 'Site Induction'), s.name, c.name, t.status::text, t.expires_at, sub.status::text, t.created_at
    from induction_tokens t
    left join induction_templates tpl on tpl.id = t.template_id
    left join sites s on s.id = t.site_id
    left join companies c on c.id = s.company_id
    left join lateral (
      select x.status from induction_submissions x where x.token_id = t.id order by x.created_at desc limit 1
    ) sub on true
   where t.employee_id = auth.uid() and t.status <> 'revoked'
   order by t.created_at desc
   limit 20;
$$;
revoke execute on function public.my_inductions() from public, anon;
grant execute on function public.my_inductions() to authenticated;
