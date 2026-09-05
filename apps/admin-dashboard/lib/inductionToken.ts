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
