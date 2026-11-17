-- Photo sharing, round two:
--   1. Each share records the site the photos were taken at (with its company).
--   2. Up to 64 photos per share (was 10).
--   3. Shares are deleted 30 days after they were sent. A daily pg_cron job
--      calls the purge-expired-photos Edge Function, which removes the files
--      through the Storage API (SQL may not delete storage objects directly)
--      and then the share rows. The app warns people 3 days before.
--
-- Before running the schedule part, store two Vault secrets (SQL editor):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<a long random string>', 'purge_photos_secret');
-- and set the same random string on the function:
--   supabase secrets set PURGE_PHOTOS_SECRET=<the same string>

alter table public.photo_shares
  add column if not exists site_id uuid references public.sites(id) on delete set null;

alter table public.photo_shares drop constraint if exists photo_shares_images_check;
alter table public.photo_shares add constraint photo_shares_images_check check (cardinality(images) between 1 and 64);

create index if not exists photo_shares_created_at_idx on public.photo_shares (created_at);

-- Same rules as before, plus: a site must belong to the share's company.
drop policy if exists photo_shares_sender_insert on public.photo_shares;
create policy photo_shares_sender_insert on public.photo_shares for insert
  with check (
    sender_id = auth.uid()
    and (company_id is null or public.is_admin() or company_id in (select public.user_company_ids()))
    and (site_id is null or exists (select 1 from public.sites s where s.id = photo_shares.site_id and s.company_id = photo_shares.company_id))
    and not exists (select 1 from unnest(images) p where p not like auth.uid()::text || '/%')
  );

-- Daily at 03:15 UTC.
create extension if not exists pg_net with schema extensions;

select cron.unschedule('purge-expired-photos') where exists (select 1 from cron.job where jobname = 'purge-expired-photos');
select cron.schedule(
  'purge-expired-photos',
  '15 3 * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/purge-expired-photos',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-purge-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'purge_photos_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
