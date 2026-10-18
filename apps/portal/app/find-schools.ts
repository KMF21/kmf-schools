"use server";

import { DEMO_SCHOOL } from "@/lib/demo";
import { IS_DEMO, publicAssetUrl } from "@/lib/env";
import { supabaseAnon } from "@/lib/supabase";

export type FoundSchool = { slug: string; name: string; address: string | null; logoUrl: string | null; brandColor: string };

/** Live schools whose name matches, for the home page search. Public details only. */
export async function findSchools(query: string): Promise<FoundSchool[]> {
  const q = String(query ?? "").trim().slice(0, 60);
  if (q.length < 3) return [];
  if (IS_DEMO) {
    const hit = [DEMO_SCHOOL.name, DEMO_SCHOOL.shortName ?? ""].some((n) => n.toLowerCase().includes(q.toLowerCase()));
    return hit ? [{ slug: DEMO_SCHOOL.slug, name: DEMO_SCHOOL.name, address: DEMO_SCHOOL.address, logoUrl: null, brandColor: DEMO_SCHOOL.brandColor }] : [];
  }
  const { data, error } = await supabaseAnon().rpc("find_schools", { p_query: q } as never);
  if (error) {
    console.error("[kmf] find schools:", error.message);
    return [];
  }
  return ((data ?? []) as Array<{ slug: string; name: string; address: string | null; logo_path: string | null; brand_color: string }>).map((s) => ({
    slug: s.slug,
    name: s.name,
    address: s.address,
    logoUrl: publicAssetUrl(s.logo_path),
    brandColor: s.brand_color,
  }));
}
