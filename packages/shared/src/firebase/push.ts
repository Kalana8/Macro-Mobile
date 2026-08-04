"use client";

import { getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging";
import { createClient } from "../supabase/client";
import { getFirebaseApp } from "./client";

// Public Web Push (VAPID) key — Firebase Console → Project settings → Cloud
// Messaging → "Web Push certificates". Safe to expose (it's the public half).
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

// The FCM background handler lives in its own service worker at a dedicated
// scope so it never collides with the app-shell worker (sw.js) at "/". The
// worker can't read process.env, so we hand it the (public) Firebase config as
// query params, built from the same NEXT_PUBLIC_* values the app already uses.
const FCM_SW_SCOPE = "/firebase-cloud-messaging-push-scope";

function fcmServiceWorkerUrl(): string {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
  return `/firebase-messaging-sw.js?${new URLSearchParams(cfg).toString()}`;
}

let messaging: Messaging | null = null;

async function getMessagingClient(): Promise<Messaging | null> {
  const app = getFirebaseApp();
  if (!app) return null;
  if (!(await isSupported())) return null;
  if (!messaging) messaging = getMessaging(app);
  return messaging;
}

/**
 * Requests notification permission, gets this device's FCM registration token,
 * and stores it in `device_tokens` so the notify-chat Edge Function can push
 * new-message alerts to exactly this user. Safe to call on every app load:
 * Firebase returns a stable token per device and the upsert is idempotent.
 * Fails silently (returns false) when unsupported, denied, or unconfigured —
 * push is an enhancement and must never block the app.
 */
export async function registerForPush(): Promise<boolean> {
  try {
    if (typeof window === "undefined") return false;
    if (!VAPID_KEY) return false; // VAPID key not configured yet
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return false;

    const m = await getMessagingClient();
    if (!m) return false;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const registration = await navigator.serviceWorker.register(fcmServiceWorkerUrl(), {
      scope: FCM_SW_SCOPE,
    });

    const token = await getToken(m, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return false;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    await supabase
      .from("device_tokens")
      .upsert({ employee_id: user.id, token, updated_at: new Date().toISOString() });

    return true;
  } catch {
    return false;
  }
}
