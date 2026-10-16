/**
 * Working out which school a request belongs to, from the address in the browser.
 *
 * Three kinds of address are supported:
 *  1. A school's own domain, e.g. portal.brightfield.com.ng — looked up in the
 *     school_domains table (exact hostname match).
 *  2. A subdomain of the platform domain, e.g. brightfield.kmfschools.ng — the
 *     subdomain is the school's slug.
 *  3. Local development, e.g. brightfield.localhost:3000 — same as (2).
 */

export type TenantLookup =
  | { kind: "slug"; slug: string; hostname: string }
  | { kind: "domain"; hostname: string }
  | { kind: "platform"; hostname: string };

/** Lower-cases, strips the port and any trailing dot. */
export function normalizeHostname(host: string | null | undefined): string {
  if (!host) return "";
  let h = host.trim().toLowerCase();
  // IPv6 literal like [::1]:3000
  if (h.startsWith("[")) {
    const end = h.indexOf("]");
    return end === -1 ? h : h.slice(0, end + 1);
  }
  const colon = h.indexOf(":");
  if (colon !== -1) h = h.slice(0, colon);
  if (h.endsWith(".")) h = h.slice(0, -1);
  return h;
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** Subdomains that never name a school. */
const RESERVED_SUBDOMAINS = new Set(["www", "app", "admin", "api", "portal", "mail", "static"]);

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug) && !RESERVED_SUBDOMAINS.has(slug);
}

/**
 * Decides how to look up the school for a hostname.
 * @param rootDomain the platform domain, e.g. "kmfschools.ng"
 */
export function classifyHost(host: string | null | undefined, rootDomain: string): TenantLookup {
  const hostname = normalizeHostname(host);
  const root = normalizeHostname(rootDomain);
  const localRoots = ["localhost", "127.0.0.1", "[::1]"];

  if (!hostname || localRoots.includes(hostname) || hostname === root || hostname === `www.${root}`) {
    return { kind: "platform", hostname };
  }

  for (const base of [root, "localhost"]) {
    if (base && hostname.endsWith(`.${base}`)) {
      const sub = hostname.slice(0, -(base.length + 1));
      // Only one level: brightfield.kmfschools.ng, not a.b.kmfschools.ng
      if (!sub.includes(".") && isValidSlug(sub)) {
        return { kind: "slug", slug: sub, hostname };
      }
      return { kind: "platform", hostname };
    }
  }

  // Vercel preview deployments are platform addresses, not schools.
  if (hostname.endsWith(".vercel.app")) return { kind: "platform", hostname };

  return { kind: "domain", hostname };
}
