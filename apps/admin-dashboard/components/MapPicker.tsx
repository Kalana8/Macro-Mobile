"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A Google map for choosing a site's exact spot: click anywhere, or drag the
 * pin. Starts on satellite view so the actual building is visible.
 *
 * The key comes from NEXT_PUBLIC_GOOGLE_MAPS_API_KEY (never written in the
 * code). It's a browser key by nature, so restrict it to the dashboard's web
 * address in Google Cloud.
 */

// The small part of the Google Maps API used here.
type LatLngLiteral = { lat: number; lng: number };
type LatLng = { lat(): number; lng(): number };
type MapsEvent = { latLng?: LatLng | null };
type Listener = { remove(): void };
type GMap = {
  panTo(p: LatLngLiteral): void;
  setZoom(z: number): void;
  getZoom(): number | undefined;
  addListener(name: string, fn: (e: MapsEvent) => void): Listener;
};
type GMarker = {
  setPosition(p: LatLngLiteral): void;
  addListener(name: string, fn: (e: MapsEvent) => void): Listener;
};
type GeocoderResult = { formatted_address: string; geometry: { location: LatLng } };
type Geocoder = { geocode(req: { address?: string; location?: LatLngLiteral }): Promise<{ results: GeocoderResult[] }> };
type Maps = {
  Map: new (el: HTMLElement, opts: object) => GMap;
  Marker: new (opts: object) => GMarker;
  Geocoder: new () => Geocoder;
};

export const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

let loading: Promise<Maps> | null = null;
// Google calls window.gm_authFailure when the key is refused (wrong key, API
// not switched on, or the web address not allowed).
let refused = false;
const onRefused = new Set<() => void>();

/** Loads the Google Maps script once for the whole dashboard. */
export function loadGoogleMaps(): Promise<Maps> {
  const w = window as unknown as { google?: { maps?: Maps }; __macroMapsReady?: () => void; gm_authFailure?: () => void };
  w.gm_authFailure = () => {
    refused = true;
    onRefused.forEach((fn) => fn());
  };
  if (w.google?.maps?.Map) return Promise.resolve(w.google.maps);
  if (loading) return loading;
  loading = new Promise<Maps>((resolve, reject) => {
    w.__macroMapsReady = () => resolve(w.google!.maps!);
    const s = document.createElement("script");
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_KEY)}&v=weekly&loading=async&callback=__macroMapsReady`;
    s.async = true;
    s.onerror = () => {
      loading = null;
      reject(new Error("Google Maps didn't load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/** Google's address search, when the Geocoding API is switched on for the key; otherwise null. */
export async function googleGeocode(req: { address?: string; location?: LatLngLiteral }) {
  try {
    const maps = await loadGoogleMaps();
    const { results } = await new maps.Geocoder().geocode(req);
    const r = results[0];
    return r ? { address: r.formatted_address, lat: r.geometry.location.lat(), lng: r.geometry.location.lng() } : null;
  } catch {
    return null;
  }
}

// Sydney, when there's no location yet.
const START = { lat: -33.8688, lng: 151.2093 };

export function MapPicker({
  lat,
  lng,
  onPick,
}: {
  lat: number | null;
  lng: number | null;
  /** Called with the exact spot chosen on the map. */
  onPick: (p: LatLngLiteral) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<GMap | null>(null);
  const marker = useRef<GMarker | null>(null);
  const pick = useRef(onPick);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pick.current = onPick;
  }, [onPick]);

  // Draw the map once.
  useEffect(() => {
    let gone = false;
    const listeners: Listener[] = [];
    const refusedMsg = () =>
      setError("Google refused the map key. In Google Cloud, switch on the Maps JavaScript API for this key and allow this web address.");
    if (refused) refusedMsg();
    onRefused.add(refusedMsg);
    loadGoogleMaps()
      .then((maps) => {
        if (gone || !box.current) return;
        const has = lat != null && lng != null;
        const at = has ? { lat: lat!, lng: lng! } : START;
        const m = new maps.Map(box.current, {
          center: at,
          zoom: has ? 19 : 11,
          mapTypeId: "hybrid",
          tilt: 0,
          streetViewControl: false,
          fullscreenControl: true,
          mapTypeControl: true,
          clickableIcons: false,
          gestureHandling: "greedy",
        });
        const pin = new maps.Marker({ map: m, position: at, draggable: true, visible: true });
        const choose = (e: MapsEvent) => {
          if (!e.latLng) return;
          const p = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          pin.setPosition(p);
          pick.current(p);
        };
        listeners.push(m.addListener("click", choose), pin.addListener("dragend", choose));
        map.current = m;
        marker.current = pin;
      })
      .catch(() => setError("Google Maps couldn't load. Check the API key and that the Maps JavaScript API is switched on."));
    return () => {
      gone = true;
      onRefused.delete(refusedMsg);
      listeners.forEach((l) => l.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the address search or "current location" moves the spot, follow it.
  useEffect(() => {
    if (lat == null || lng == null || !map.current || !marker.current) return;
    const p = { lat, lng };
    marker.current.setPosition(p);
    map.current.panTo(p);
    if ((map.current.getZoom() ?? 0) < 17) map.current.setZoom(19);
  }, [lat, lng]);

  if (error) return <p className="mt-2 text-[11px] text-error-text">{error}</p>;
  return (
    <div className="mt-2.5">
      <div ref={box} className="h-[320px] w-full overflow-hidden rounded-[10px] border border-border bg-bg" aria-label="Map: click to set the site's exact location" />
      <p className="mt-1.5 text-[11px] text-text-muted">Click the exact spot on the map, or drag the pin. Zoom in for the building&apos;s entrance.</p>
    </div>
  );
}
