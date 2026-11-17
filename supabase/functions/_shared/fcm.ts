// Firebase Cloud Messaging (HTTP v1), shared by send-push and notify-chat.
// Uses the Firebase service-account secrets already set for
// mint-firebase-token: FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY and
// (optionally) FIREBASE_PROJECT_ID.

export type DeviceToken = { employee_id: string; token: string; platform: string | null };
export type PushMessage = { title: string; body: string; href: string };

function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const contents = pem.replace(/-----BEGIN PRIVATE KEY-----/, "").replace(/-----END PRIVATE KEY-----/, "").replace(/\s/g, "");
  const der = Uint8Array.from(atob(contents), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

export function fcmConfig() {
  const clientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL");
  const privateKey = Deno.env.get("FIREBASE_PRIVATE_KEY")?.replace(/\\n/g, "\n");
  const projectId = Deno.env.get("FIREBASE_PROJECT_ID") ?? clientEmail?.split("@")[1]?.split(".")[0];
  return projectId && clientEmail && privateKey ? { projectId, clientEmail, privateKey } : null;
}

async function accessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(
    JSON.stringify({ iss: clientEmail, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }),
  )}`;
  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, key, new TextEncoder().encode(unsigned));
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${base64url(new Uint8Array(signature))}` }),
  });
  const json = await res.json();
  if (!res.ok || !json.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(json)}`);
  return json.access_token as string;
}

/**
 * Sends one message to each device. Phones (android/ios) get a visible
 * notification that opens `href` in the app when tapped; web browsers get the
 * data-only message their service worker turns into a notification.
 * Returns how many were sent and which tokens are dead.
 */
export async function sendToDevices(devices: DeviceToken[], msg: PushMessage, webUrl?: string) {
  const cfg = fcmConfig();
  if (!cfg) throw new Error("Firebase isn't configured — set the FIREBASE_* secrets.");
  const auth = await accessToken(cfg.clientEmail, cfg.privateKey);
  const endpoint = `https://fcm.googleapis.com/v1/projects/${cfg.projectId}/messages:send`;
  let sent = 0;
  const stale: string[] = [];
  await Promise.all(
    devices.map(async ({ token, platform }) => {
      const phone = platform === "android" || platform === "ios";
      const message = phone
        ? {
            token,
            notification: { title: msg.title, body: msg.body },
            data: { href: msg.href },
            android: { priority: "high", notification: { channel_id: "default", sound: "default" } },
            apns: { payload: { aps: { sound: "default" } } },
          }
        : { token, data: { title: msg.title, body: msg.body, url: webUrl ?? msg.href }, webpush: { headers: { Urgency: "high" } } };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (res.ok) sent++;
      else {
        const err = await res.json().catch(() => ({}));
        const status = err?.error?.status;
        if (status === "NOT_FOUND" || status === "UNREGISTERED" || status === "INVALID_ARGUMENT") stale.push(token);
      }
    }),
  );
  return { sent, stale };
}
