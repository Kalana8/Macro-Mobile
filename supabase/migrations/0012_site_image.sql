-- Sites can now have a photo shown on the employee app's Home site cards
-- (uploaded to ImageKit like other attachments — this column just stores
-- the resulting public URL).
alter table sites add column if not exists image text;
