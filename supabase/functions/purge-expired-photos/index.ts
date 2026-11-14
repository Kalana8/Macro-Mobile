// Supabase Edge Function: deletes shared photos 30 days after they were sent.
//
// Called once a day by the pg_cron job in migration 0049, never by the apps.
// The call must carry the x-purge-secret header matching the
// PURGE_PHOTOS_SECRET function secret; anything else gets 401. Deploy with
// verify_jwt: false, since the cron job has no user session.
//
// Files are removed through the Storage API (SQL may not delete storage
// objects directly, and doing so would leave the files behind), then the share
// rows, whose recipients go with them (on delete cascade).
//
// Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, which Supabase provides to
// every Edge Function. Nothing is hard-coded.

import { createClient } from "jsr:@supabase/supabase-js@2";

const KEEP_DAYS = 30;
const BATCH = 200;
const BUCKET = "shared-photos";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Constant-time compare, so the secret can't be guessed from response timing. */
function sameSecret(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const secret = Deno.env.get("PURGE_PHOTOS_SECRET");
  if (!secret) return json({ error: "PURGE_PHOTOS_SECRET is not set" }, 500);
  if (!sameSecret(req.headers.get("x-purge-secret") ?? "", secret)) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let shares = 0;
  let files = 0;
  // Loop in batches; each pass removes what it read, so the next pass reads the next ones.
  for (let pass = 0; pass < 50; pass++) {
    const { data, error } = await admin.from("photo_shares").select("id, images").lt("created_at", cutoff).limit(BATCH);
    if (error) return json({ error: error.message, shares, files }, 500);
    if (!data || data.length === 0) break;

    const paths = data.flatMap((s: { images: string[] }) => s.images);
    for (let i = 0; i < paths.length; i += 1000) {
      const { error: removeError } = await admin.storage.from(BUCKET).remove(paths.slice(i, i + 1000));
      // Stop rather than delete rows whose files are still stored, so nothing is orphaned.
      if (removeError) return json({ error: removeError.message, shares, files }, 500);
    }
    files += paths.length;

    const ids = data.map((s: { id: string }) => s.id);
    const { error: deleteError } = await admin.from("photo_shares").delete().in("id", ids);
    if (deleteError) return json({ error: deleteError.message, shares, files }, 500);
    shares += ids.length;
    if (data.length < BATCH) break;
  }

  return json({ ok: true, shares, files, cutoff });
});
