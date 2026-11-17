-- Deleting a company or a site in the dashboard removes everything of it from
-- the employee app too.
--
-- Most data already went with it (on delete cascade). These links were only
-- cleared, which left records in the app with no company or site:
--   photo_shares.company_id, photo_shares.site_id  -> the share now goes too
--   checklists.site_id                             -> the site's checklists go too
-- (Deleting an employee already removes everything that is theirs.)

alter table public.photo_shares drop constraint if exists photo_shares_company_id_fkey;
alter table public.photo_shares add constraint photo_shares_company_id_fkey
  foreign key (company_id) references public.companies(id) on delete cascade;

alter table public.photo_shares drop constraint if exists photo_shares_site_id_fkey;
alter table public.photo_shares add constraint photo_shares_site_id_fkey
  foreign key (site_id) references public.sites(id) on delete cascade;

alter table public.checklists drop constraint if exists checklists_site_id_fkey;
alter table public.checklists add constraint checklists_site_id_fkey
  foreign key (site_id) references public.sites(id) on delete cascade;
