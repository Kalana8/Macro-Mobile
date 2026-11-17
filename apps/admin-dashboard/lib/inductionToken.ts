import { randomBytes, createHash } from "node:crypto";

/** A cryptographically random token — the raw value is only ever put in the URL, never stored (only its hash is). */
export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function addDuration(base: Date, amount: number, unit: "hours" | "days"): Date {
  const ms = unit === "hours" ? amount * 3600_000 : amount * 86_400_000;
  return new Date(base.getTime() + ms);
}

/**
 * Where links point: the dashboard address this request came in on, so the
 * app can build a link for the employee later (migration 0054).
 */
export async function requestOrigin(): Promise<string | null> {
  const { headers } = await import("next/headers");
  const h = await headers();
  const origin = h.get("origin");
  if (origin && /^https?:\/\/[^/\s]+$/.test(origin)) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return null;
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** The token columns the induction page reads, matched on the invitation link or the app's key (0054). */
export function tokenHashFilter(tokenHash: string): string {
  // tokenHash is a sha256 hex digest, so it is safe to put in the filter.
  return `token_hash.eq.${tokenHash},app_token_hash.eq.${tokenHash}`;
}
