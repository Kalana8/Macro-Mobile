-- Location-based site login & clock-in/clock-out validation.
--
-- Fixes a pre-existing gap first: apps/employee-app's clock-in/clock-out
-- actions already read/write clock_in_address / clock_out_address, but no
-- earlier migration ever created these columns (a fresh migration replay
-- would fail on the very first clock-in).
alter table attendance add column if not exists clock_in_address text;
alter table attendance add column if not exists clock_out_address text;

-- Numeric distance (meters) from the site at clock-in/clock-out, alongside
-- the existing geo_verified / clock_out_geo_verified pass/fail booleans —
-- so the admin dashboard can show "146 m" next to "Location Mismatch"
-- rather than just pass/fail.
alter table attendance add column if not exists clock_in_distance double precision;
alter table attendance add column if not exists clock_out_distance double precision;

-- Per-site configurable geofence radius (meters) — previously a hardcoded
-- 20 everywhere (client geo lib default, admin site-form help text, the
-- unused geofence-verify edge function). Defaults to 20 to match existing
-- behavior for every already-created site.
alter table sites add column if not exists allowed_radius integer not null default 20;
alter table sites add constraint sites_allowed_radius_positive check (allowed_radius > 0);
