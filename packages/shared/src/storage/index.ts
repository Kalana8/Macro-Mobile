"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

/** Uploads a file under `{pathPrefix}/...` in `bucket` and returns its storage path (not a URL — the bucket is private, so callers resolve a signed URL to actually display it). */
export async function uploadImage(
  supabase: SupabaseClient,
  bucket: string,
  pathPrefix: string,
  file: File
): Promise<string> {
  const path = `${pathPrefix}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file);
  if (error) throw error;
  return path;
}

/** Resolves a storage path to a short-lived signed URL for display. Null if it fails (e.g. the object was deleted). */
export async function resolveSignedUrl(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  expiresInSeconds = 3600
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}
