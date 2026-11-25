// Supabase Edge Function — uploads a photo from the employee app to ImageKit
// and returns its public URL, the same kind of URL the web apps store (so the
// admin dashboard shows it without changes). Used for checklist photos and
// chat images.
//
//   POST multipart/form-data: file (image), folder ("checklists" | "communication" | "audits")
//   Authorization: Bearer <the employee's Supabase session token>
//   → { url } or { error }
//
// Only signed-in, active employees can upload; only images up to 10 MB; only
// into the folders above. The ImageKit private key stays here as the secret
// IMAGEKIT_PRIVATE_KEY and never reaches the phone.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const FOLDERS = new Set(["checklists", "communication", "audits"]);
const MAX_BYTES = 10 * 1024 * 1024;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  // Tolerate a key pasted with spaces, a line break or quotes around it.
  const privateKey = (Deno.env.get("IMAGEKIT_PRIVATE_KEY") ?? "").trim().replace(/^["']|["']$/g, "").trim();
  if (!privateKey) return json({ error: "Photo uploads aren't switched on yet. Contact your admin." }, 501);

  // Who is uploading: their own session, checked with Supabase.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Sign in again." }, 401);
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Sign in again." }, 401);
  const { data: employee } = await supabase.from("employees").select("status").eq("id", user.id).maybeSingle();
  if (!employee || employee.status !== "active") return json({ error: "Your account can't upload photos." }, 403);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "Send the photo as form data." }, 400);
  }
  const folder = String(form.get("folder") ?? "");
  const file = form.get("file");
  if (!FOLDERS.has(folder)) return json({ error: "Unknown folder." }, 400);
  if (!(file instanceof File)) return json({ error: "No photo was sent." }, 400);
  if (file.size === 0 || file.size > MAX_BYTES) return json({ error: "Photos must be under 10 MB." }, 413);
  if (file.type && !file.type.startsWith("image/")) return json({ error: "Only photos can be uploaded." }, 415);

  const name = (file.name || `photo-${Date.now()}.jpg`).replace(/[^\w.-]/g, "_").slice(0, 80);
  const upload = new FormData();
  upload.set("file", file, name);
  upload.set("fileName", name);
  upload.set("folder", `/${folder}`);
  upload.set("useUniqueFileName", "true");

  const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${privateKey}:`)}` },
    body: upload,
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok || !out.url) {
    // ImageKit's reason, for the function logs (never the key). A 401/403 means
    // the IMAGEKIT_PRIVATE_KEY secret isn't the account's private key.
    console.error("ImageKit upload failed", res.status, (out as { message?: string }).message ?? "", "key starts:", privateKey.slice(0, 8));
    if (res.status === 401 || res.status === 403) {
      return json({ error: "Photo uploads are set up with the wrong key. Contact your admin." }, 502);
    }
    return json({ error: "The photo couldn't be uploaded. Try again." }, 502);
  }
  return json({ url: out.url as string });
});
