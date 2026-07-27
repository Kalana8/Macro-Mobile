"use client";

import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import { type Auth, getAuth } from "firebase/auth";
import { type Firestore, getFirestore } from "firebase/firestore";

// Firebase is used exclusively for chat (Firestore) + push (FCM) per
// Architecture Document §6. Auth stays on Supabase; a Supabase Edge
// Function ("mint-firebase-token", not yet implemented — see
// supabase/migrations) mints a matching Firebase custom token so users
// never see a second login.

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;
let auth: Auth | null = null;

/** Lazily initializes and returns the Firebase app (client-only, chat use only). */
export function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfig.projectId) return null; // no project configured yet
  if (!app) {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  }
  return app;
}

/** Lazily initializes and returns the Firestore instance, or null if unconfigured. */
export function getChatDb(): Firestore | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!db) db = getFirestore(firebaseApp);
  return db;
}

/** Lazily initializes and returns Firebase Auth, or null if unconfigured. */
export function getFirebaseAuthClient(): Auth | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;
  if (!auth) auth = getAuth(firebaseApp);
  return auth;
}
