-- Employees per site. A company can have several sites with different
-- employees at each (e.g. Seoul Garden – Glen Waverly and – Chadstone).
--
-- employee_companies stays as it is (it still decides what company data an
-- employee may read). employee_sites says which of the company's sites they
-- work at: only those show in the app and under that site in the dashboard.
-- Adding someone to one site never adds them to the company's other sites,
-- and a new site starts with nobody on it.
--
-- So nobody loses their sites, everyone already in a company is put on that
-- company's current sites once, below.

create table if not exists public.employee_sites (
  employee_id uuid not null references public.employees(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (employee_id, site_id)
);
create index if not exists employee_sites_site_idx on public.employee_sites(site_id);

alter table public.employee_sites enable row level security;
drop policy if exists employee_sites_admin_all on public.employee_sites;
create policy employee_sites_admin_all on public.employee_sites for all to authenticated
  using (is_admin()) with check (is_admin());
drop policy if exists employee_sites_self_select on public.employee_sites;
create policy employee_sites_self_select on public.employee_sites for select to authenticated
  using (employee_id = auth.uid());

-- One-time: today's company members keep the sites they see now.
insert into public.employee_sites (employee_id, site_id)
select ec.employee_id, s.id
  from public.employee_companies ec
  join public.sites s on s.company_id = ec.company_id
 -- Only the first time: running this file again mustn't undo later changes.
 where not exists (select 1 from public.employee_sites)
on conflict do nothing;

-- Site inductions (0056) follow the site, not the company: someone added to
-- Glen Waverly gets Glen Waverly's inductions, not Chadstone's.
create or replace function public.send_site_inductions_to_site(target_employee uuid, target_site uuid)
returns int
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  si record;
  new_id uuid;
  sent int := 0;
begin
  for si in select x.* from site_inductions x where x.active and x.site_id = target_site loop
    if exists (
      select 1 from induction_tokens t
       where t.employee_id = target_employee and t.site_id = si.site_id and t.template_id = si.template_id
         and (t.status = 'completed' or (t.status = 'active' and t.expires_at > now()))
    ) then
      continue;
    end if;
    insert into induction_tokens (employee_id, site_id, template_id, token_hash, expires_at, created_by, link_base_url)
    values (target_employee, si.site_id, si.template_id,
            encode(digest(encode(gen_random_bytes(32), 'hex'), 'sha256'), 'hex'),
            now() + make_interval(days => si.expiry_days), si.created_by, si.link_base_url)
    returning id into new_id;
    insert into induction_token_history (token_id, action, new_expires_at, performed_by, note)
    select new_id, 'created', t.expires_at, si.created_by, 'Sent automatically: employee added to the site.'
      from induction_tokens t where t.id = new_id;
    sent := sent + 1;
  end loop;
  return sent;
end;
$$;
revoke execute on function public.send_site_inductions_to_site(uuid, uuid) from public, anon, authenticated;

create or replace function public.site_inductions_on_new_site_member()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.send_site_inductions_to_site(new.employee_id, new.site_id);
  return new;
end;
$$;
revoke execute on function public.site_inductions_on_new_site_member() from public, anon, authenticated;

drop trigger if exists employee_sites_site_inductions on public.employee_sites;
create trigger employee_sites_site_inductions
  after insert on public.employee_sites
  for each row execute function public.site_inductions_on_new_site_member();

-- No longer sent to the whole company on joining it.
drop trigger if exists employee_companies_site_inductions on public.employee_companies;
