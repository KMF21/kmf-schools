import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL } from "./env";

/** Supabase client acting as the signed-in person. Row level security applies. */
export async function supabaseForRequest() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session on every request, so this is safe to ignore.
        }
      },
    },
  });
}

let anonClient: ReturnType<typeof createClient> | null = null;

/** Signed-out client, used only for the public school lookup. */
export function supabaseAnon() {
  anonClient ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return anonClient;
}

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>;

/**
 * Supabase returns at most 1,000 rows per request. This keeps asking for the
 * next 1,000 until everything is in, so large classes and schools are never
 * cut off. `page(from, to)` must sort by a unique key so pages don't overlap.
 */
export async function fetchAll<T>(page: (from: number, to: number) => Page<T>, size = 1000): Promise<{ data: T[]; error: { message: string; code?: string } | null }> {
  const all: T[] = [];
  for (let from = 0; from < 200_000; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) return { data: all, error };
    all.push(...(data ?? []));
    if (!data || data.length < size) break;
  }
  return { data: all, error: null };
}
