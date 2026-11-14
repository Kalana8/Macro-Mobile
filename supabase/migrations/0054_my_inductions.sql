-- Employees see their own induction invitations in the app (Profile, plus a
-- reminder on Home until they complete it) and can open the induction from
-- there.
--
-- Invitation links stay unrecoverable: only a hash of each link is stored,
-- as before. When an employee taps Open, open_my_induction() makes a fresh
-- random "app" key for their own active invitation, stores only its hash
-- (app_token_hash), and returns the link. The admin's original link keeps
-- working; the induction page accepts either key.
--
-- link_base_url is the dashboard address the invitation was created from, so
-- the app can build a link without being configured with it.

alter table public.induction_tokens
  add column if not exists app_token_hash text unique,
  add column if not exists link_base_url text;

/** Your own invitations, newest first, with the template, site and submission state. */
create or replace function public.my_inductions()
returns table (id uuid, template_name text, site_name text, status text, expires_at timestamptz, submission_status text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select t.id, coalesce(tpl.name, 'Site Induction'), s.name, t.status::text, t.expires_at, sub.status::text, t.created_at
    from induction_tokens t
    left join induction_templates tpl on tpl.id = t.template_id
    left join sites s on s.id = t.site_id
    left join lateral (
      select x.status from induction_submissions x where x.token_id = t.id order by x.created_at desc limit 1
    ) sub on true
   where t.employee_id = auth.uid() and t.status <> 'revoked'
   order by t.created_at desc
   limit 20;
$$;

/**
 * A working link for one of your own active, unexpired invitations. Each call
 * replaces the previous app key. fallback_base is only used for invitations
 * created before link_base_url was recorded, and must be an https address.
 */
create or replace function public.open_my_induction(target_token_id uuid, fallback_base text default null)
returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  base text;
  raw text;
begin
  select coalesce(t.link_base_url, case when fallback_base ~ '^https://[^/\s]+$' then fallback_base end)
    into base
    from induction_tokens t
   where t.id = target_token_id and t.employee_id = auth.uid() and t.status = 'active' and t.expires_at > now();
  if not found then
    raise exception 'This induction link is no longer available. Ask the office for a new one.' using errcode = '42501';
  end if;
  if base is null then
    raise exception 'Ask the office to send this induction link again.' using errcode = 'P0001';
  end if;
  raw := rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '=');
  update induction_tokens set app_token_hash = encode(digest(raw, 'sha256'), 'hex') where id = target_token_id;
  return base || '/induction/' || raw;
end;
$$;

revoke execute on function public.my_inductions(), public.open_my_induction(uuid, text) from public, anon;
grant execute on function public.my_inductions(), public.open_my_induction(uuid, text) to authenticated;
