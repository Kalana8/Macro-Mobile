"use client";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { signInWithCustomToken } from "firebase/auth";
import { createClient } from "../supabase/client";
import { getChatDb, getFirebaseAuthClient } from "./client";

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  images: string[];
  createdAt: unknown;
}

let signInPromise: Promise<boolean> | null = null;

/**
 * Signs the current Supabase-authenticated user into Firebase, via a
 * matching custom token minted server-side (see supabase/functions/
 * mint-firebase-token) — so there's no second login screen. Memoized per
 * page load: safe to call before every chat action. Returns false if
 * Firebase isn't configured yet (see firebase/client.ts) or minting fails.
 */
export function ensureFirebaseSession(): Promise<boolean> {
  const auth = getFirebaseAuthClient();
  if (!auth) return Promise.resolve(false);
  if (auth.currentUser) return Promise.resolve(true);

  if (!signInPromise) {
    signInPromise = (async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.functions.invoke<{ token: string }>("mint-firebase-token");
        if (error || !data?.token) return false;
        await signInWithCustomToken(auth, data.token);
        return true;
      } catch {
        return false;
      } finally {
        signInPromise = null;
      }
    })();
  }
  return signInPromise;
}

/**
 * Mirrors the minimal fields Firestore security rules need to authorize
 * per-conversation access (matching the Postgres `communications` row's
 * recipients/company_id) — call once when a new thread is created, before
 * the first message is sent. `conversationId` is that row's id. Any of the
 * listed employees (or an admin) can read/write the conversation.
 */
export async function createConversation(
  conversationId: string,
  meta: { employeeIds: string[]; companyId: string; siteId: string | null }
): Promise<void> {
  const db = getChatDb();
  if (!db) throw new Error("Firebase is not configured.");
  await setDoc(doc(db, "conversations", conversationId), {
    employeeIds: meta.employeeIds,
    companyId: meta.companyId,
    siteId: meta.siteId,
    createdAt: serverTimestamp(),
  });
}

/** Subscribes to conversations/{conversationId}/messages, newest last. Returns an unsubscribe fn. */
export function subscribeToMessages(
  conversationId: string,
  onMessages: (messages: ChatMessage[]) => void
): Unsubscribe | null {
  const db = getChatDb();
  if (!db) return null;

  const messagesRef = collection(db, "conversations", conversationId, "messages");
  const q = query(messagesRef, orderBy("createdAt", "asc"));

  return onSnapshot(q, (snapshot) => {
    onMessages(
      snapshot.docs.map((d) => ({ id: d.id, images: [], ...d.data() }) as unknown as ChatMessage)
    );
  });
}

export async function sendMessage(
  conversationId: string,
  senderId: string,
  senderName: string,
  text: string,
  images: string[] = []
): Promise<void> {
  const db = getChatDb();
  if (!db) throw new Error("Firebase is not configured.");

  const messagesRef = collection(db, "conversations", conversationId, "messages");
  await addDoc(messagesRef, { senderId, senderName, text, images, createdAt: serverTimestamp() });
}
