/**
 * A checklist's name as the app's checklist page shows it: the company and
 * the site ("Seoul Garden · Chadstone"), not the long list of every area.
 * Used for downloads, copies and shares.
 */
export function checklistName(companyName: string | null | undefined, site: string | null | undefined): string {
  return [companyName, site].map((s) => (s ?? "").trim()).filter((s) => s && s !== "—").join(" · ") || "Checklist";
}
