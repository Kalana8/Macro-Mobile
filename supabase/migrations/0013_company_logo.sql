-- The employee app's Home site cards show the company's logo (uploaded
-- once per company, not per site) — matches the reference design where
-- every site under the same company shares one logo image.
alter table companies add column if not exists logo text;
