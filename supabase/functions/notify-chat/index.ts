// Supabase Edge Function — sends a "new message" web-push to exactly the
// recipients of one chat thread, never a broadcast. This is what makes chat
// notifications suitable-user-only:
//
//   1. The caller is authenticated from their own Supabase session.
//   2. We confirm the caller is actually a recipient of `conversationId`
//      (same membership check RLS uses) before sending anything — so nobody
//      can trigger notifications for a thread they're not in.
//   3. We look up the OTHER recipients' FCM device tokens with the service
//      role (RLS would only let the caller read their own tokens) and push to
//      those, excluding the sender.
//
// Reuses the Firebase service-account secrets already set for
// mint-firebase-token (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
// FIREBASE_PRIVATE_KEY). FCM messaging is free — no Cloud Functions / Blaze.
//
// Deployed with verify_jwt: false for the same CORS-preflight reason as
// mint-firebase-token; auth is verified by hand via getUser() below.

import { createClient } from "jsr:@supabase/supabase-js@2";

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

/** Exchanges the service account for a short-lived OAuth token scoped to FCM. */
async function getFcmAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  )}`;
  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(unsigned)
  );
  const assertion = `${unsigned}.${base64url(new Uint8Array(signature))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(json)}`);
  }
  return json.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Missing Authorization header" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Caller identity, checked against their own session.
  const authed = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
    error: authError,
  } = await authed.auth.getUser();
  if (authError || !user) return jsonResponse({ error: "Invalid session" }, 401);

  let body: { conversationId?: string; preview?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  const conversationId = String(body.conversationId ?? "");
  const preview = String(body.preview ?? "New message").slice(0, 140);
  if (!conversationId) return jsonResponse({ error: "conversationId is required" }, 400);

  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  // Project id: explicit secret if set, otherwise derived from the service
  // account email (firebase-adminsdk-…@<projectId>.iam.gserviceaccount.com) so
  // we don't require a separate FIREBASE_PROJECT_ID secret.
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID") ?? clientEmail?.split("@")[1]?.split(".")[0];
  if (!projectId || !clientEmail || !privateKey) {
    return jsonResponse({ error: "Firebase isn't configured — set the FIREBASE_* secrets." }, 501);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Authorize: the caller must be a member of this conversation.
  const { data: recipients, error: recipErr } = await admin
    .from("communication_recipients")
    .select("employee_id")
    .eq("communication_id", conversationId);
  if (recipErr) return jsonResponse({ error: recipErr.message }, 500);

  const memberIds = (recipients ?? []).map((r) => r.employee_id as string);
  if (!memberIds.includes(user.id)) {
    return jsonResponse({ error: "Not a participant of this conversation" }, 403);
  }

  const targetIds = memberIds.filter((id) => id !== user.id);
  if (targetIds.length === 0) return jsonResponse({ sent: 0, reason: "no other recipients" });

  const [{ data: tokenRows }, { data: sender }, { data: thread }] = await Promise.all([
    admin.from("device_tokens").select("employee_id, token").in("employee_id", targetIds),
    admin.from("employees").select("full_name").eq("id", user.id).maybeSingle(),
    admin.from("communications").select("title").eq("id", conversationId).maybeSingle(),
  ]);

  const tokens = (tokenRows ?? []) as { employee_id: string; token: string }[];
  if (tokens.length === 0) return jsonResponse({ sent: 0, reason: "no registered devices" });

  const senderName = (sender?.full_name as string) ?? "Someone";
  const title = (thread?.title as string) ?? "New message";
  const bodyText = `${senderName}: ${preview}`;

  const accessToken = await getFcmAccessToken(clientEmail, privateKey);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  let sent = 0;
  const staleTokens: string[] = [];

  await Promise.all(
    tokens.map(async ({ token }) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        // Data-only message: the service worker (firebase-messaging-sw.js)
        // builds and shows the notification, avoiding the duplicate that a
        // `notification` payload would cause on web, and controlling click-through.
        body: JSON.stringify({
          message: {
            token,
            data: {
              title,
              body: bodyText,
              conversationId,
              url: `/communication/${conversationId}`,
            },
            webpush: { headers: { Urgency: "high" } },
          },
        }),
      });
      if (res.ok) {
        sent++;
      } else {
        const err = await res.json().catch(() => ({}));
        const status = err?.error?.status;
        // FCM tells us when a token is dead — prune it so we stop trying.
        if (status === "NOT_FOUND" || status === "UNREGISTERED" || status === "INVALID_ARGUMENT") {
          staleTokens.push(token);
        }
      }
    })
  );

  if (staleTokens.length > 0) {
    await admin.from("device_tokens").delete().in("token", staleTokens);
  }

  return jsonResponse({ sent, recipients: targetIds.length, pruned: staleTokens.length });
});
