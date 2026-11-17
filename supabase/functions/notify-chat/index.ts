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
import { type DeviceToken, fcmConfig, sendToDevices } from "../_shared/fcm.ts";

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

  if (!fcmConfig()) {
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
    admin.from("device_tokens").select("employee_id, token, platform").in("employee_id", targetIds),
    admin.from("employees").select("full_name").eq("id", user.id).maybeSingle(),
    admin.from("communications").select("title").eq("id", conversationId).maybeSingle(),
  ]);

  const tokens = (tokenRows ?? []) as DeviceToken[];
  if (tokens.length === 0) return jsonResponse({ sent: 0, reason: "no registered devices" });

  const senderName = (sender?.full_name as string) ?? "Someone";
  const title = (thread?.title as string) ?? "New message";
  const bodyText = `${senderName}: ${preview}`;

  // Phones get a notification that opens the conversation in the app; browsers
  // get the data-only message their service worker shows.
  const { sent, stale: staleTokens } = await sendToDevices(
    tokens,
    { title, body: bodyText, href: `/chat/${conversationId}` },
    `/communication/${conversationId}`,
  );

  if (staleTokens.length > 0) {
    await admin.from("device_tokens").delete().in("token", staleTokens);
  }

  return jsonResponse({ sent, recipients: targetIds.length, pruned: staleTokens.length });
});
