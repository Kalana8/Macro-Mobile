"use client";

import { useEffect } from "react";
import { registerForPush } from "@macro/shared/firebase/push";

/**
 * Registers this device for push once the app shell has mounted. Renders
 * nothing. registerForPush() is idempotent and fails silently, so it's safe to
 * run on every load — it prompts for notification permission the first time and
 * refreshes the stored FCM token thereafter.
 */
export function PushRegistration() {
  useEffect(() => {
    registerForPush();
  }, []);

  return null;
}
