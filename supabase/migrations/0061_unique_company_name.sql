-- One company per name (ignoring case and spaces at either end). Adding a
-- company whose name already exists adds its site to that company instead
-- (dashboard createCompanyAction), so the company page shows all its sites.
create unique index if not exists companies_name_unique on public.companies (lower(btrim(name)));
