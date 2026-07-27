-- Add Company was simplified to: Company Name, Site Name, Location
-- (geographic coordinates), Visit Days & Time — dropping the separate
-- free-text city/state description as a required field. The coordinates
-- (sites.lat/lng) are the source of truth for the geofence; these text
-- columns are display-only now, so they no longer need to be required.
alter table companies alter column location drop not null;
alter table sites alter column address drop not null;
