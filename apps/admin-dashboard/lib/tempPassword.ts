import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts the temporary password the office gives an employee, so the
 * Employees page can show it until they set their own (migration 0063).
 * AES-256-GCM; the key never goes to the database. It comes from
 * TEMP_PASSWORD_KEY if set, otherwise it is derived from the service-role key
 * (already a server-only secret). Changing either makes old copies unreadable,
 * and the page then asks for a password reset.
 */
function key(): Buffer {
  const secret = process.env.TEMP_PASSWORD_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("No server key to protect temporary passwords.");
  return createHash("sha256").update(`macro-temp-password:${secret}`).digest();
}

export function sealPassword(password: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(".");
}

export function openPassword(sealed: string): string | null {
  try {
    const [v, iv, tag, data] = sealed.split(".");
    if (v !== "v1") return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
