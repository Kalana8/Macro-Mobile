/**
 * A coordinate from a form field. An empty field is "not set" (NaN), not 0:
 * Number("") is 0, which once saved a site at 0, 0 (in the ocean off Africa),
 * so every clock-in there showed "Location not matched".
 */
export function readCoord(v: FormDataEntryValue | null): number {
  const s = String(v ?? "").trim();
  return s === "" ? NaN : Number(s);
}

/** True when the coordinates are missing, not numbers, or the 0, 0 placeholder. */
export function coordsMissing(lat: number, lng: number): boolean {
  return Number.isNaN(lat) || Number.isNaN(lng) || (lat === 0 && lng === 0);
}

export const COORDS_MISSING_MESSAGE =
  "Set the site's exact location: click it on the map, or use \"Use my current location\" at the site.";
