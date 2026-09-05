/**
 * Normalizes a Supabase "to-one" relationship embed (e.g. `employees(full_name)`
 * off a foreign key). The untyped Supabase client can't always tell a given
 * embed is to-one vs. to-many, so PostgREST's response — and the client's
 * inferred type — sometimes comes back as an array instead of a single
 * object. Use this wherever such an embed is read, rather than assuming one
 * shape.
 */
export function toOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
