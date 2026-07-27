// Supabase Edge Function — authoritative server-side geofence check.
// Architecture Document §3: "never trust a client-only distance
// calculation for the authoritative clock-in." The employee-app currently
// re-checks the geofence inside the clockIn Server Action directly against
// Postgres (see apps/employee-app/app/(app)/attendance/actions.ts); this
// function exists so the same check can also be invoked independently
// (e.g. from a future mobile client that talks to Supabase directly).
//
// TODO(feature-pass): deploy with `supabase functions deploy geofence-verify`
// once a Supabase project exists. Not yet wired into either app.

import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_RADIUS_M = 20;

function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

Deno.serve(async (req) => {
  const { siteId, lat, lng } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: site, error } = await supabase
    .from("sites")
    .select("lat, lng")
    .eq("id", siteId)
    .single();

  if (error || !site) {
    return new Response(JSON.stringify({ error: "Site not found" }), { status: 404 });
  }

  const distance = haversineDistanceMeters(lat, lng, site.lat, site.lng);
  const withinRange = distance <= DEFAULT_RADIUS_M;

  return new Response(JSON.stringify({ withinRange, distance }), {
    headers: { "Content-Type": "application/json" },
  });
});
