import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { IS_DEMO, SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";

/**
 * Runs before every page:
 *  1. Passes the visitor's address on to the app, which uses it to find the school.
 *  2. Keeps the Supabase sign-in fresh, so sessions don't expire mid-task.
 *
 * Access control is NOT decided here. Every page and server action checks the
 * signed-in person itself, and the database enforces it again with row level security.
 */
export async function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-kmf-host", request.headers.get("host") ?? "");

  let response = NextResponse.next({ request: { headers } });
  if (IS_DEMO) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, cacheHeaders) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request: { headers } });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(cacheHeaders ?? {})) response.headers.set(key, value);
      },
    },
  });

  // Refreshes the session cookie if needed. Must run before any rendering.
  await supabase.auth.getClaims();
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)"],
};
