-- Up to 128 photos per share (was 64, 0049). The app compresses each photo
-- before upload (longest side 1600 px, JPEG 60%), so this stays light.
alter table public.photo_shares drop constraint if exists photo_shares_images_check;
alter table public.photo_shares add constraint photo_shares_images_check check (cardinality(images) between 1 and 128);
