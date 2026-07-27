import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Server Supabase client — use from Server Components, Server Actions,
 * and Route Handlers. Must be created fresh per request (reads cookies()).
 * Falls back to placeholder config if no Supabase project is connected yet
 * (see README) — queries then fail at the network layer, which every
 * caller already handles via the query's `{ data, error }` result, rather
 * than throwing at client construction and crashing the whole route.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component with no request context to
          // write to — safe to ignore as long as middleware refreshes
          // the session on every request.
        }
      },
    },
  });
}

/**
 * Service-role Supabase client — server-only, bypasses RLS. Used for
 * privileged admin operations (e.g. provisioning employee auth users).
 * Never import this from a Client Component or expose the key to the browser.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-role-key",
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
