import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "./env";

/**
 * Supabase with the secret key: bypasses row level security and can create
 * accounts. Used ONLY for creating logins and resetting passwords, always after
 * the caller has been checked as a manager of the school, and every query here
 * is filtered by that school. Never import this from a client component.
 */
const SECRET = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export const ADMIN_AVAILABLE = Boolean(SUPABASE_URL && SECRET);

let client: ReturnType<typeof createClient> | null = null;

export function adminClient() {
  if (!ADMIN_AVAILABLE) return null;
  client ??= createClient(SUPABASE_URL, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

export const ADMIN_MISSING_MESSAGE =
  "Logins can't be created yet because the portal's secret setting (SUPABASE_SECRET_KEY) isn't set up. Ask KMF support to add it.";
