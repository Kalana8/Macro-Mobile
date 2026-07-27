"use client";

import { useState } from "react";
import { geocodeAddress, getCurrentPosition, reverseGeocode } from "@macro/shared/geo";
import { FieldLabel, TextInput } from "@/components/ui";

/**
 * One combined location input: type an address and it's geocoded to
 * coordinates on blur, or tap "Use my current location" to fill both the
 * address and coordinates from the browser's geolocation. The lat/lng are
 * carried as hidden fields — server-side code never trusts the address text,
 * only the coordinates (re-validated again at every login/clock-in).
 */
export function LocationField({
  addressFieldName,
  latFieldName,
  lngFieldName,
  initialAddress = "",
  initialLat,
  initialLng,
  helpText = "Used for the 20m geofenced login/clock-in.",
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

  async function handleAddressBlur() {
    const trimmed = address.trim();
    if (!trimmed) return;
    setStatus("busy");
    setMessage(null);
    try {
      const result = await geocodeAddress(trimmed);
      if (!result) {
        setStatus("error");
        setMessage(
          "Couldn't find that address at all — free map data often lacks exact street/building addresses. Stand at the site and tap \"Use my current location\" instead."
        );
        return;
      }
      setLat(String(result.lat));
      setLng(String(result.lng));
      setAccuracy(null);
      if (result.approximate) {
        setStatus("approximate");
        setMessage(
          "Only found the general area, not the exact address — this may not be accurate enough for the 20m geofence. Stand at the site and tap \"Use my current location\" to be sure."
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
      if (pos.accuracy > 20) {
        setMessage(
          `GPS accuracy is only ±${Math.round(pos.accuracy)}m here — for a precise 20m geofence, try again outdoors or closer to the site.`
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
      <button
        type="button"
        onClick={useCurrentLocation}
        disabled={status === "busy"}
        className="mt-2.5 w-full rounded-[10px] bg-bg py-2.5 text-[12.5px] font-bold text-primary disabled:opacity-50"
      >
        {status === "busy" ? "Locating…" : "📍 Use my current location"}
      </button>
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
      <input type="hidden" name={latFieldName} value={lat} />
      <input type="hidden" name={lngFieldName} value={lng} />
    </div>
  );
}
