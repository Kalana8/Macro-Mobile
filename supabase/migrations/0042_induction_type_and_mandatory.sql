-- Broad classification for an assignment (WHS General / Site-Specific /
-- Contractor / Visitor / Equipment), separate from the free-text `category`
-- field, plus whether completing it is mandatory. WHS inductions default to
-- mandatory; existing rows are treated as WHS/mandatory since that's the
-- type this whole system was originally built around.
alter table induction_templates
  add column if not exists induction_type text not null default 'whs',
  add column if not exists is_mandatory boolean not null default true;
