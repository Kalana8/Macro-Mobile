"use client";

import { useState } from "react";
import { geocodeAddress, getCurrentPosition, reverseGeocode } from "@macro/shared/geo";
import { FieldLabel, TextInput } from "@/components/ui";
import { GOOGLE_MAPS_KEY, googleGeocode, MapPicker } from "@/components/MapPicker";

/**
 * One combined location input: type an address and it's geocoded to
 * coordinates on blur, or tap "Use my current location" to fill both the
 * address and coordinates from the browser's geolocation. The lat/lng are
 * carried as hidden fields — server-side code never trusts the address text,
 * only the coordinates (re-validated again at every login/clock-in).
 *
 * With a Google Maps key set, a map opens under the address: click the exact
 * spot (or drag the pin) to set the coordinates precisely.
 */
export function LocationField({
  addressFieldName,
  latFieldName,
  lngFieldName,
  initialAddress = "",
  initialLat,
  initialLng,
  helpText = "Used for the 35 m geofenced login/clock-in.",
}: {
  addressFieldName: string;
  latFieldName: string;
  lngFieldName: string;
  initialAddress?: string;
  initialLat?: number;
  initialLng?: number;
  helpText?: string;
}) {
  const [address, setAddress] = useState(initialAddress);
  const [lat, setLat] = useState(initialLat != null ? String(initialLat) : "");
  const [lng, setLng] = useState(initialLng != null ? String(initialLng) : "");
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "busy" | "found" | "approximate" | "error">(
    initialLat != null && initialLng != null ? "found" : "idle"
  );
  const [message, setMessage] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(Boolean(GOOGLE_MAPS_KEY));

  // Clicked on the map: that exact spot, then fill in the address for it.
  async function pickOnMap(p: { lat: number; lng: number }) {
    setLat(String(p.lat));
    setLng(String(p.lng));
    setAccuracy(null);
    setStatus("found");
    setMessage(null);
    const place = (await googleGeocode({ location: p }))?.address ?? (await reverseGeocode(p.lat, p.lng).catch(() => null));
    if (place) setAddress(place);
  }

  async function handleAddressBlur() {
    const trimmed = address.trim();
    if (!trimmed) return;
    setStatus("busy");
    setMessage(null);
    try {
      // Google first (when its Geocoding API is on), then the free lookup.
      const google = await googleGeocode({ address: trimmed });
      const result = google ? { lat: google.lat, lng: google.lng, approximate: false } : await geocodeAddress(trimmed);
      if (!result) {
        setStatus("error");
        setMessage(
          GOOGLE_MAPS_KEY
            ? "Couldn't find that address. Click the exact spot on the map instead."
            : "Couldn't find that address at all — free map data often lacks exact street/building addresses. Stand at the site and tap \"Use my current location\" instead."
        );
        return;
      }
      setLat(String(result.lat));
      setLng(String(result.lng));
      setAccuracy(null);
      if (result.approximate) {
        setStatus("approximate");
        setMessage(
          GOOGLE_MAPS_KEY
            ? "Only found the general area. Click the exact spot on the map to be sure."
            : "Only found the general area, not the exact address — this may not be accurate enough for the 35 m geofence. Stand at the site and tap \"Use my current location\" to be sure."
        );
      } else {
        setStatus("found");
      }
    } catch {
      setStatus("error");
      setMessage("Couldn't look up that address right now — try again or use current location.");
    }
  }

  async function useCurrentLocation() {
    setStatus("busy");
    setMessage(null);
    try {
      const pos = await getCurrentPosition();
      setLat(String(pos.lat));
      setLng(String(pos.lng));
      setAccuracy(pos.accuracy);
      try {
        const place = await reverseGeocode(pos.lat, pos.lng);
        if (place) setAddress(place);
      } catch {
        // Coordinates are captured either way — the address label is a nicety.
      }
      setStatus("found");
      if (pos.accuracy > 35) {
        setMessage(
          `GPS accuracy is only ±${Math.round(pos.accuracy)}m here — for a precise 35 m geofence, try again outdoors or closer to the site.`
        );
      }
    } catch {
      setStatus("error");
      setMessage("Couldn't get your location — check the browser's location permission and try again.");
    }
  }

  return (
    <div className="rounded-[11px] border border-border p-3">
      <FieldLabel>Location</FieldLabel>
      <p className="mb-2 -mt-1 text-[11px] text-text-muted">{helpText}</p>
      <TextInput
        name={addressFieldName}
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        onBlur={handleAddressBlur}
        placeholder="Type an address, e.g. 123 Main St, Colombo"
      />
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={useCurrentLocation}
          disabled={status === "busy"}
          className="flex-1 rounded-[10px] bg-bg py-2.5 text-[12.5px] font-bold text-primary disabled:opacity-50"
        >
          {status === "busy" ? "Locating…" : "📍 Use my current location"}
        </button>
        {GOOGLE_MAPS_KEY && (
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className="flex-1 rounded-[10px] bg-bg py-2.5 text-[12.5px] font-bold text-primary"
          >
            {showMap ? "Hide map" : "🗺️ Pick on map"}
          </button>
        )}
      </div>
      {status === "found" && lat && lng && (
        <p className="mt-1.5 text-[11px] text-text-muted">
          Located ✓ ({Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
          {accuracy != null ? `, ±${Math.round(accuracy)}m` : ""})
        </p>
      )}
      {status === "approximate" && lat && lng && (
        <p className="mt-1.5 text-[11px] text-[#B35A10]">
          Approximate area only ({Number(lat).toFixed(5)}, {Number(lng).toFixed(5)})
        </p>
      )}
      {message && (
        <p className={`mt-1.5 text-[11px] ${status === "error" ? "text-error-text" : "text-[#B35A10]"}`}>{message}</p>
      )}
      {showMap && <MapPicker lat={lat ? Number(lat) : null} lng={lng ? Number(lng) : null} onPick={pickOnMap} />}
      <input type="hidden" name={latFieldName} value={lat} />
      <input type="hidden" name={lngFieldName} value={lng} />
    </div>
  );
}
