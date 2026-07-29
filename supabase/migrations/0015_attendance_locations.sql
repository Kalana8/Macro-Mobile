-- Clock Out now re-checks the geofence too (previously only Clock In did),
-- and both clock-in/clock-out coordinates are stored so the admin dashboard
-- can show exactly where each employee was for each event.
alter table attendance add column if not exists clock_in_lat double precision;
alter table attendance add column if not exists clock_in_lng double precision;
alter table attendance add column if not exists clock_out_lat double precision;
alter table attendance add column if not exists clock_out_lng double precision;
alter table attendance add column if not exists clock_out_geo_verified boolean not null default false;
