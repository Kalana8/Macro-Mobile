-- Induction content becomes admin-manageable templates (reusable sets of
-- acknowledgement items), rather than one fixed hardcoded form — mirrors
-- the "Templates" pattern (name, description, editable sections, used-in
-- count) already familiar from checklist_templates.

create table induction_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  -- [{ id: string, label: string }, ...]
  sections jsonb not null default '[]'::jsonb,
  created_by uuid references employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table induction_tokens add column if not exists template_id uuid references induction_templates(id) on delete set null;

alter table induction_templates enable row level security;
create policy induction_templates_admin_all on induction_templates for all to authenticated
  using (is_admin()) with check (is_admin());

-- Seed a default template so existing/new invitations work immediately
-- without forcing the admin to build one first.
insert into induction_templates (name, description, sections)
values (
  'Standard Site Induction',
  'Default site safety induction — site rules, PPE, emergency procedures, and hazards.',
  '[
    {"id": "siteRules", "label": "I have read and understood the site safety rules."},
    {"id": "ppe", "label": "I understand the PPE (Personal Protective Equipment) requirements for this site."},
    {"id": "emergency", "label": "I understand the emergency procedures and evacuation points for this site."},
    {"id": "hazards", "label": "I have been made aware of the known hazards present on this site."}
  ]'::jsonb
);
