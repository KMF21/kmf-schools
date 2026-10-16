export const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "kmfschools.ng";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * Demo mode runs the whole portal on built-in sample data, with no database.
 * It switches on automatically when Supabase isn't configured, so the portal can
 * be shown to a school before anything is set up.
 */
export const IS_DEMO = !SUPABASE_URL || !SUPABASE_KEY;

export const ASSETS_BUCKET = "school-assets";

export function publicAssetUrl(path: string | null | undefined): string | null {
  if (!path || IS_DEMO) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/${ASSETS_BUCKET}/${path}`;
}
