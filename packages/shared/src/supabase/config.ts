// @supabase/ssr throws synchronously at client-construction time if the
// URL/key are empty. Before a real Supabase project is connected (see
// README "Getting started"), we still want every route to render — so we
// fall back to harmless placeholder values that let the client construct
// successfully; queries against them fail at the network layer instead,
// which callers already handle via each query's `{ data, error }` result.

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
