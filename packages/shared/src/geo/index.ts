// Haversine distance + geofence check, ported verbatim from
// "Architecture Document.dc.html" §3 (Geofenced Login).

export const DEFAULT_GEOFENCE_RADIUS_M = 20;

/** Great-circle distance between two lat/lng points, in meters. */
export function haversineDistanceMeters(
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

/**
 * True if the user is within `radiusM` of the site.
 * Client-side result is UX-only — the authoritative check must be
 * re-run server-side (Edge Function) before writing the attendance row.
 */
export function withinGeofence(
  userLat: number,
  userLng: number,
  siteLat: number,
  siteLng: number,
  radiusM: number = DEFAULT_GEOFENCE_RADIUS_M
): boolean {
  return haversineDistanceMeters(userLat, userLng, siteLat, siteLng) <= radiusM;
}

export interface GeolocationResult {
  lat: number;
  lng: number;
  /** Radius (meters) the device itself reports as its confidence — not a
   *  distance to anything. A single getCurrentPosition() call often returns
   *  a fast network/Wi-Fi fix with accuracy of 50-100m+, which is useless
   *  against a 20m geofence. */
  accuracy: number;
}

/**
 * Gets a GPS fix accurate enough to trust against the 20m geofence. The
 * first reading from the device is frequently a fast, coarse (Wi-Fi/cell)
 * fix rather than a true GPS lock, so this watches for up to `maxWaitMs`,
 * keeping the best (lowest-accuracy-number) reading seen, and resolves as
 * soon as one reaches `desiredAccuracyM`. If the deadline passes first, it
 * resolves with the best reading it got rather than failing outright — the
 * server re-checks the geofence anyway, so a slightly-worse-than-ideal fix
 * should still surface as a normal "too far away" rejection, not a dead end.
 * Client-only.
 */
export function getCurrentPosition({
  desiredAccuracyM = 20,
  maxWaitMs = 15000,
}: { desiredAccuracyM?: number; maxWaitMs?: number } = {}): Promise<GeolocationResult> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not available in this environment."));
      return;
    }

    let best: GeolocationResult | null = null;
    let watchId: number;
    let settled = false;

    function finish() {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      navigator.geolocation.clearWatch(watchId);
      if (best) resolve(best);
      else reject(new Error("Couldn't get a GPS fix in time."));
    }

    const timer = setTimeout(finish, maxWaitMs);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const reading: GeolocationResult = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        if (!best || reading.accuracy < best.accuracy) best = reading;
        if (reading.accuracy <= desiredAccuracyM) finish();
      },
      (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        navigator.geolocation.clearWatch(watchId);
        reject(err);
      },
      { enableHighAccuracy: true, timeout: maxWaitMs, maximumAge: 0 }
    );
  });
}

// Address <-> coordinates lookups via OpenStreetMap Nominatim (free, no API
// key). Client-only, best-effort — callers should treat a null result as
// "couldn't resolve" and let the admin fall back to typing coordinates or
// using their current location instead.

export interface GeocodeResult {
  lat: number;
  lng: number;
  /** True if the exact address wasn't found and this is a broader-area match
   *  (e.g. the street couldn't be found so it fell back to the city). Not
   *  precise enough to trust for the 20m geofence on its own — the caller
   *  should still prompt for "use my current location" to nail it down. */
  approximate: boolean;
}

/**
 * Resolves a typed address to coordinates. If the full address isn't found
 * (common for specific street/building addresses in areas with sparse
 * OpenStreetMap coverage), progressively drops the leading comma-separated
 * segment (assumed to be the most specific part) and retries against
 * broader area names, marking the result `approximate`. Returns null if
 * nothing matches at any level.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const segments = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const attempts = segments.length > 0 ? segments.map((_, i) => segments.slice(i).join(", ")) : [address];

  for (let i = 0; i < attempts.length; i++) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(attempts[i])}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("Geocoding request failed.");
    const results: { lat: string; lon: string }[] = await res.json();
    if (results.length > 0) {
      return { lat: Number(results[0].lat), lng: Number(results[0].lon), approximate: i > 0 };
    }
  }
  return null;
}

/** Resolves coordinates to a human-readable address. Returns null if nothing matched. */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Reverse geocoding request failed.");
  const result: { display_name?: string } = await res.json();
  return result.display_name ?? null;
}
