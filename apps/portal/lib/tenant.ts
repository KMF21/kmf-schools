import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { classifyHost, isValidSlug, type School } from "@kmf/core";
import { IS_DEMO, ROOT_DOMAIN, publicAssetUrl } from "./env";
import { DEMO_SCHOOL } from "./demo";
import { supabaseAnon } from "./supabase";

export type Tenant =
  | { kind: "school"; school: School; hostname: string; chosenByPath: boolean }
  | { kind: "platform"; hostname: string }
  | { kind: "unknown"; hostname: string };

type Row = {
  id: string;
  slug: string;
  name: string;
  short_name: string | null;
  motto: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_path: string | null;
  brand_color: string;
  status: School["status"];
};

/** Short-lived memory cache so a busy result day doesn't look the school up on every request. */
const CACHE_MS = 60_000;
const memo = new Map<string, { at: number; school: School | null }>();

async function lookup(key: string, args: { p_hostname?: string; p_slug?: string }): Promise<School | null> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.school;

  const { data, error } = await supabaseAnon().rpc("resolve_school", args as never);
  if (error) throw new Error(`Could not look up the school for ${key}: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : null) as Row | null;
  const school: School | null = row
    ? {
        id: row.id,
        slug: row.slug,
        name: row.name,
        shortName: row.short_name,
        motto: row.motto,
        address: row.address,
        phone: row.phone,
        email: row.email,
        logoUrl: publicAssetUrl(row.logo_path),
        brandColor: row.brand_color,
        status: row.status,
      }
    : null;
  memo.set(key, { at: Date.now(), school });
  return school;
}

/** Which school does this request belong to? Resolved once per request. */
export const getTenant = cache(async (): Promise<Tenant> => {
  const h = await headers();
  const target = classifyHost(h.get("x-kmf-host") ?? h.get("host"), ROOT_DOMAIN);

  if (target.kind === "platform") {
    // Platform addresses (kmf-schools.vercel.app, preview links, localhost) have no
    // subdomain to name a school, so /s/<slug> remembers one in a cookie instead.
    const chosen = (await cookies()).get(CHOSEN_SCHOOL_COOKIE)?.value;
    const school = chosen && isValidSlug(chosen) ? await findSchoolBySlug(chosen) : null;
    return school
      ? { kind: "school", school, hostname: target.hostname, chosenByPath: true }
      : { kind: "platform", hostname: target.hostname };
  }

  if (IS_DEMO) {
    // Demo mode: any school address shows the demo school, so links can be shared freely.
    return { kind: "school", school: DEMO_SCHOOL, hostname: target.hostname, chosenByPath: false };
  }

  const school =
    target.kind === "slug"
      ? await findSchoolBySlug(target.slug)
      : await lookup(`host:${target.hostname}`, { p_hostname: target.hostname });

  return school
    ? { kind: "school", school, hostname: target.hostname, chosenByPath: false }
    : { kind: "unknown", hostname: target.hostname };
});

export const CHOSEN_SCHOOL_COOKIE = "kmf_school";

/** Drops cached lookups after a school's details change, so this server shows them at once. */
export function forgetSchool(schoolId: string): void {
  for (const [key, value] of memo) if (value.school?.id === schoolId) memo.delete(key);
}

export async function findSchoolBySlug(slug: string): Promise<School | null> {
  if (IS_DEMO) return slug === DEMO_SCHOOL.slug ? DEMO_SCHOOL : null;
  return lookup(`slug:${slug}`, { p_slug: slug });
}

/** For pages that only make sense inside a school. */
export async function requireSchool(): Promise<School> {
  const tenant = await getTenant();
  if (tenant.kind !== "school") redirect("/");
  return tenant.school;
}
