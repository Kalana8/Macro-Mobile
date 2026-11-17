// Supabase Edge Function — sends a push notification to particular employees'
// phones (and browsers). Called only by the database (triggers and the daily
// job in migration 0064), which proves itself with the x-push-secret header;
// nobody else can send. Never a broadcast: the caller names the employees.
//
// Secrets: PUSH_SECRET (same value as the Vault secret push_secret) and the
// FIREBASE_* secrets already used by mint-firebase-token / notify-chat.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { type DeviceToken, sendToDevices } from "../_shared/fcm.ts";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const secret = Deno.env.get("PUSH_SECRET");
  if (!secret || req.headers.get("x-push-secret") !== secret) return json({ error: "Forbidden" }, 403);

  let body: { employee_ids?: string[]; title?: string; body?: string; href?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const ids = [...new Set((body.employee_ids ?? []).filter((x) => typeof x === "string"))].slice(0, 500);
  const title = String(body.title ?? "").slice(0, 120);
  const text = String(body.body ?? "").slice(0, 240);
  const href = String(body.href ?? "/");
  if (!ids.length || !title) return json({ sent: 0, reason: "nothing to send" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: rows, error } = await admin.from("device_tokens").select("employee_id, token, platform").in("employee_id", ids);
  if (error) return json({ error: error.message }, 500);
  const devices = (rows ?? []) as DeviceToken[];
  if (!devices.length) return json({ sent: 0, reason: "no registered devices" });

  const { sent, stale } = await sendToDevices(devices, { title, body: text, href });
  if (stale.length) await admin.from("device_tokens").delete().in("token", stale);
  return json({ sent, pruned: stale.length });
});
