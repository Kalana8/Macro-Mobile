/**
 * A checklist's name as the app's checklist page shows it: the company and
 * the site ("Seoul Garden · Chadstone"), not the long list of every area.
 * Used for downloads, copies and shares.
 */
export function checklistName(companyName: string | null | undefined, site: string | null | undefined): string {
  return [companyName, site].map((s) => (s ?? "").trim()).filter((s) => s && s !== "—").join(" · ") || "Checklist";
}

/** Two letters for a name, as in the app: "Seoul Garden" → "SG", "Macro" → "MA". */
export function initialsOf(name: string): string {
  const words = name.split("@")[0].split(/[\s._-]+/).filter((w) => /[a-z0-9]/i.test(w));
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** "2026-11-12" → "12-11-2026" */
const dmy = (iso: string) => iso.slice(0, 10).split("-").reverse().join("-");
// Characters computers and phones don't allow in file names.
const safe = (s: string) => s.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * A downloaded checklist's file name, the same as the app's:
 * "Checklist-12-11-2026-SG-Glen Waverly" (date, company initials, site).
 * Several at once: "Checklists-07-11-2026-to-12-11-2026".
 */
export function checklistFileName(list: { assigned_date: string; site?: string | null; companyName?: string | null }[]): string {
  if (list.length === 1) {
    const c = list[0];
    const company = (c.companyName ?? "").trim();
    return safe(["Checklist", dmy(c.assigned_date), company && company !== "—" ? initialsOf(company) : "", c.site ?? ""].filter(Boolean).join("-"));
  }
  const dates = list.map((c) => c.assigned_date).sort();
  const first = dmy(dates[0] ?? "");
  const last = dmy(dates[dates.length - 1] ?? "");
  return safe(first === last ? `Checklists-${first}` : `Checklists-${first}-to-${last}`);
}
