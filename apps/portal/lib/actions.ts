import type { School } from "@kmf/core";
import { IS_DEMO } from "./env";
import { getViewer, isManager, type Viewer } from "./session";
import { supabaseForRequest } from "./supabase";
import { getTenant } from "./tenant";

/** What every form action returns. `ok` is a confirmation to show, `error` a problem to fix. */
export type ActionState = { ok?: string; error?: string; fields?: Record<string, string> };

export const DEMO_READ_ONLY: ActionState = {
  error: "This is the demo school, so changes aren't saved. On a real school, this would save straight away.",
};

type Context = { school: School; viewer: Viewer; supabase: Awaited<ReturnType<typeof supabaseForRequest>> };

/**
 * For actions only school managers (proprietor, admin, KMF admin) may run.
 * Checks on the server every time; the database checks again with row level security.
 */
export async function managerContext(): Promise<{ ctx: Context } | { error: ActionState }> {
  if (IS_DEMO) return { error: DEMO_READ_ONLY };
  const tenant = await getTenant();
  if (tenant.kind !== "school") return { error: { error: "Open your school's portal to make changes." } };
  const viewer = await getViewer(tenant.school);
  if (!viewer) return { error: { error: "Your session has ended. Sign in again, then retry." } };
  if (!isManager(viewer)) return { error: { error: "Only the proprietor or school admin can make this change." } };
  return { ctx: { school: tenant.school, viewer, supabase: await supabaseForRequest() } };
}

/** Turns empty form strings into null, and trims everything else. */
export function text(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/** Plain-language message for a database error, without exposing internals. */
export function friendly(error: { message: string; code?: string } | null, what: string): ActionState {
  if (!error) return {};
  if (error.code === "23505") return { error: `That ${what} already exists. Use a different name.` };
  if (error.code === "42501") return { error: `You don't have permission to change this ${what}.` };
  console.error(`[kmf] ${what}:`, error.message);
  return { error: `The ${what} couldn't be saved. Check your connection and try again.` };
}
