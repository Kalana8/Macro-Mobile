-- Employee Site Induction system: Admin creates an induction invitation for
-- an employee at a site, sends an external (unauthenticated) link, the
-- employee completes the induction form and submits, a certificate is
-- generated and goes to Admin for approval, after which the employee is
-- considered site-induction-active. Layered heavily with an expiration
-- system on the invitation link itself (separate from certificate validity
-- — see induction_certificates.expires_at, a completely independent
-- 12-month-default concept from the 7-day-default link expiration).

create type induction_token_status as enum ('active', 'expired', 'revoked', 'completed');
create type induction_submission_status as enum ('draft', 'pending_approval', 'approved', 'rejected');
create type induction_certificate_status as enum ('pending', 'active', 'expired', 'revoked');

-- ---------------------------------------------------------------------------
-- induction_tokens — one row per invitation link. Only a hash of the actual
-- token is stored; the raw token lives only in the URL sent to the
-- employee, never persisted, so a database read alone can never yield a
-- usable link.
-- ---------------------------------------------------------------------------
create table induction_tokens (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references employees(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  token_hash text not null unique,
  status induction_token_status not null default 'active',
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  last_accessed_at timestamptz
);
create index induction_tokens_employee_id_idx on induction_tokens(employee_id);
create index induction_tokens_site_id_idx on induction_tokens(site_id);
create index induction_tokens_status_idx on induction_tokens(status);

-- ---------------------------------------------------------------------------
-- induction_token_history — audit trail for extend/regenerate/revoke, so an
-- admin action on expiration is never silent.
-- ---------------------------------------------------------------------------
create table induction_token_history (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references induction_tokens(id) on delete cascade,
  action text not null, -- 'created' | 'extended' | 'regenerated' | 'revoked'
  old_expires_at timestamptz,
  new_expires_at timestamptz,
  performed_by uuid references employees(id) on delete set null,
  performed_at timestamptz not null default now(),
  note text
);
create index induction_token_history_token_id_idx on induction_token_history(token_id);

-- ---------------------------------------------------------------------------
-- induction_submissions — the employee's actual induction content. Created
-- as 'draft' the moment they start (so "your progress may be saved" after
-- an expiry mid-induction is literally true), moved to 'pending_approval' on
-- submit, then 'approved'/'rejected' by an admin.
-- ---------------------------------------------------------------------------
create table induction_submissions (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references induction_tokens(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  acknowledgements jsonb not null default '{}'::jsonb,
  signature_name text,
  status induction_submission_status not null default 'draft',
  submitted_at timestamptz,
  reviewed_by uuid references employees(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index induction_submissions_token_id_idx on induction_submissions(token_id);
create index induction_submissions_employee_id_idx on induction_submissions(employee_id);
create index induction_submissions_status_idx on induction_submissions(status);

-- ---------------------------------------------------------------------------
-- induction_certificates — issued once a submission is approved. Its own
-- expires_at (default 12 months) is entirely independent of the invitation
-- link's expires_at on induction_tokens.
-- ---------------------------------------------------------------------------
create table induction_certificates (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references induction_submissions(id) on delete cascade,
  employee_id uuid not null references employees(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  certificate_number text not null unique,
  file_url text,
  status induction_certificate_status not null default 'pending',
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index induction_certificates_employee_id_idx on induction_certificates(employee_id);
create index induction_certificates_site_id_idx on induction_certificates(site_id);
create index induction_certificates_status_idx on induction_certificates(status);

-- ---------------------------------------------------------------------------
-- RLS — admin-only for authenticated dashboard access. The public
-- (unauthenticated) /induction/[token] link never uses these policies at
-- all: it reads/writes via the service-role client, scoped to the exact
-- hashed token, mirroring the existing /shared/checklists/[id] pattern.
-- ---------------------------------------------------------------------------
alter table induction_tokens enable row level security;
alter table induction_token_history enable row level security;
alter table induction_submissions enable row level security;
alter table induction_certificates enable row level security;

create policy induction_tokens_admin_all on induction_tokens for all to authenticated
  using (is_admin()) with check (is_admin());
create policy induction_token_history_admin_all on induction_token_history for all to authenticated
  using (is_admin()) with check (is_admin());
create policy induction_submissions_admin_all on induction_submissions for all to authenticated
  using (is_admin()) with check (is_admin());
create policy induction_certificates_admin_all on induction_certificates for all to authenticated
  using (is_admin()) with check (is_admin());

-- Grant the new "inductions" dashboard permission to the existing Admin
-- role so the module works immediately without manual Roles & Access setup.
update roles
set permissions = jsonb_set(
  permissions,
  '{dashboard,inductions}',
  '{"view": true, "create": true, "manage": true, "approve": true}'::jsonb
)
where name = 'Admin';
