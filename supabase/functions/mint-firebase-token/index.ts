// Supabase Edge Function — mints a Firebase custom token from the caller's
// verified Supabase session, per Architecture Document §6 (Firebase Auth
// bridge): "so users sign into Firebase transparently (no second login)."
//
// Signs the token by hand (RS256 via Web Crypto) instead of pulling in the
// full firebase-admin SDK — the custom-token JWT format is simple and
// publicly documented, and hand-signing avoids firebase-admin's heavier,
// Node-oriented dependencies inside the Deno edge runtime.
//
// Deployed with verify_jwt: false — the platform's JWT gate rejects CORS
// preflight (OPTIONS) requests outright, since browsers never send custom
// headers like Authorization on a preflight, which breaks every browser
// call before it starts. Auth is instead verified by hand below (getUser()
// against the caller's own Authorization header), which is the real check.
//
// Requires these secrets (Supabase Dashboard -> Edge Functions -> Secrets),
// all three taken directly from the Firebase service account JSON:
//   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY

import { createClient } from "jsr:@supabase/supabase-js@2";

const FIREBASE_AUD =
  "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const contents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const der = Uint8Array.from(atob(contents), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, [
    "sign",
  ]);
}

async function signCustomToken(
  uid: string,
  claims: Record<string, unknown>,
  clientEmail: string,
  privateKeyPem: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(
    JSON.stringify({
      iss: clientEmail,
      sub: clientEmail,
      aud: FIREBASE_AUD,
      iat: now,
      exp: now + 3600,
      uid,
      claims,
    })
  )}`;

  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(unsigned)
  );
  return `${unsigned}.${base64url(new Uint8Array(signature))}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: "Missing Authorization header" }, 401);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return jsonResponse({ error: "Invalid session" }, 401);
  }

  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    return jsonResponse({ error: "Firebase isn't configured yet — set the FIREBASE_* secrets." }, 501);
  }

  const { data: employee } = await supabase
    .from("employees")
    .select("id, roles(is_admin)")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = Boolean((employee?.roles as { is_admin?: boolean } | null)?.is_admin);

  const token = await signCustomToken(user.id, { employeeId: user.id, admin: isAdmin }, clientEmail, privateKey);

  return jsonResponse({ token });
});
