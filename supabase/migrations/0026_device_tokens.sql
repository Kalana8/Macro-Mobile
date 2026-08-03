-- Per-device FCM registration tokens for web push. One employee can have
-- several (phone, laptop, etc.), so the primary key is (employee_id, token).
-- The notify-chat Edge Function reads these (via the service role) to push a
-- "new message" notification to exactly a conversation's recipients — never a
-- broadcast. RLS keeps each employee able to manage only their own tokens; the
-- Edge Function bypasses RLS deliberately because it must read the *recipients'*
-- tokens, and it authorizes that send by confirming the caller is a member of
-- the conversation first.
create table if not exists device_tokens (
  employee_id uuid not null references employees(id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now(),
  primary key (employee_id, token)
);

create index if not exists device_tokens_employee_id_idx on device_tokens(employee_id);

alter table device_tokens enable row level security;

-- An employee can register/refresh/remove only their own device tokens.
create policy device_tokens_self_all on device_tokens for all to authenticated
  using (employee_id = auth.uid())
  with check (employee_id = auth.uid());
