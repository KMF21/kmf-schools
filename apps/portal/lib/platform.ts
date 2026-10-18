import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { School } from "@kmf/core";
import { DEMO_SCHOOL, DEMO_STUDENTS } from "./demo";
import { IS_DEMO, ROOT_DOMAIN, publicAssetUrl } from "./env";
import { supabaseForRequest } from "./supabase";
import { getTenant } from "./tenant";

/**
 * The KMF admin area (/admin): every school on the platform. Only people in
 * platform_admins get in, and the database checks that again on every query.
 */

export const DEMO_ADMIN_COOKIE = "kmf_demo_admin";

export type PlatformAdmin = { userId: string; email: string | null };

export const getPlatformAdmin = cache(async (): Promise<PlatformAdmin | null> => {
  if (IS_DEMO) return (await cookies()).get(DEMO_ADMIN_COOKIE)?.value === "1" ? { userId: "demo-kmf", email: "support@kmfenterprise.ng" } : null;
  const supabase = await supabaseForRequest();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;
  const { data } = await supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  return { userId, email: typeof claims.claims.email === "string" ? claims.claims.email : null };
});

/** The admin area lives on platform addresses only, never on a school's own domain. */
export async function onPlatformAddress(): Promise<boolean> {
  const tenant = await getTenant();
  return tenant.kind === "platform" || (tenant.kind === "school" && tenant.chosenByPath);
}

export async function requirePlatformAdmin(): Promise<PlatformAdmin> {
  if (!(await onPlatformAddress())) redirect("/");
  const admin = await getPlatformAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}

export type SchoolStatus = School["status"];

export type SchoolSummary = {
  id: string;
  slug: string;
  name: string;
  brandColor: string;
  logoUrl: string | null;
  status: SchoolStatus;
  createdAt: string;
  students: number;
  domains: string[];
  /** Latest invoice, for the list of schools. */
  billing: { plan: string; label: string | null; status: "unpaid" | "paid" | "waived" | null; overdue: boolean; amount: number | null };
};

export type SchoolDomain = { hostname: string; kind: "portal" | "website"; isPrimary: boolean; verifiedAt: string | null };
export type SchoolPerson = { userId: string; name: string; role: string };
export type SchoolDetail = Omit<SchoolSummary, "billing"> & { shortName: string | null; email: string | null; phone: string | null; domainRows: SchoolDomain[]; managers: SchoolPerson[] };

const DEMO_SUMMARY: SchoolSummary = {
  id: DEMO_SCHOOL.id,
  slug: DEMO_SCHOOL.slug,
  name: DEMO_SCHOOL.name,
  brandColor: DEMO_SCHOOL.brandColor,
  logoUrl: null,
  status: "active",
  createdAt: "2026-09-01T09:00:00Z",
  students: DEMO_STUDENTS.length,
  domains: ["portal.brightfield.example"],
  billing: { plan: "per_student", label: "First term, 2026/2027", status: "paid", overdue: false, amount: 680000 },
};

type SchoolRow = { id: string; slug: string; name: string; short_name: string | null; email: string | null; phone: string | null; brand_color: string; logo_path: string | null; status: SchoolStatus; created_at: string };

export async function listSchools(): Promise<SchoolSummary[]> {
  if (IS_DEMO) return [DEMO_SUMMARY];
  const supabase = await supabaseForRequest();
  const [{ data: schools, error }, { data: domains }, { data: plans }, { data: invoices }] = await Promise.all([
    supabase.from("schools").select("id, slug, name, short_name, email, phone, brand_color, logo_path, status, created_at").order("name"),
    supabase.from("school_domains").select("hostname, school_id").order("hostname"),
    supabase.from("billing_plans").select("school_id, plan"),
    supabase.from("invoices").select("school_id, label, status, amount, due_on, created_at").order("created_at", { ascending: false }).limit(1000),
  ]);
  const todayLagos = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
  if (error) throw new Error(`Could not load schools: ${error.message}`);
  const rows = (schools ?? []) as SchoolRow[];
  // One small count per school: fine for the tens of schools KMF expects.
  const counts = await Promise.all(
    rows.map(async (s) => {
      const { count } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", s.id).eq("status", "active");
      return count ?? 0;
    }),
  );
  return rows.map((s, i) => ({
    id: s.id,
    slug: s.slug,
    name: s.name,
    brandColor: s.brand_color,
    logoUrl: publicAssetUrl(s.logo_path),
    status: s.status,
    createdAt: s.created_at,
    students: counts[i]!,
    domains: (domains ?? []).filter((d) => d.school_id === s.id).map((d) => d.hostname),
    billing: (() => {
      const plan = (plans ?? []).find((p) => p.school_id === s.id)?.plan ?? "per_student";
      const inv = (invoices ?? []).find((x) => x.school_id === s.id);
      return {
        plan,
        label: inv?.label ?? null,
        status: inv?.status ?? null,
        overdue: Boolean(inv && inv.status === "unpaid" && inv.due_on < todayLagos),
        amount: inv ? Number(inv.amount) : null,
      };
    })(),
  }));
}

export async function getSchoolDetail(id: string): Promise<SchoolDetail | null> {
  if (IS_DEMO) {
    if (id !== DEMO_SCHOOL.id) return null;
    const { billing: _billing, ...demo } = DEMO_SUMMARY;
    void _billing;
    return {
      ...demo,
      shortName: DEMO_SCHOOL.shortName,
      email: DEMO_SCHOOL.email,
      phone: DEMO_SCHOOL.phone,
      domainRows: [{ hostname: "portal.brightfield.example", kind: "portal", isPrimary: true, verifiedAt: null }],
      managers: [
        { userId: "demo-owner", name: "Dr Hauwa Bello", role: "owner" },
        { userId: "demo-admin", name: "Mrs Grace Ishaku", role: "admin" },
      ],
    };
  }
  const supabase = await supabaseForRequest();
  const { data: s, error } = await supabase
    .from("schools")
    .select("id, slug, name, short_name, email, phone, brand_color, logo_path, status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the school: ${error.message}`);
  if (!s) return null;
  const row = s as SchoolRow;
  const [domains, members, students] = await Promise.all([
    supabase.from("school_domains").select("hostname, kind, is_primary, verified_at").eq("school_id", id).order("hostname"),
    supabase.from("school_members").select("user_id, display_name, role").eq("school_id", id).in("role", ["owner", "admin"]).order("role"),
    supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", id).eq("status", "active"),
  ]);
  const domainRows: SchoolDomain[] = (domains.data ?? []).map((d) => ({ hostname: d.hostname, kind: d.kind, isPrimary: d.is_primary, verifiedAt: d.verified_at }));
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    email: row.email,
    phone: row.phone,
    brandColor: row.brand_color,
    logoUrl: publicAssetUrl(row.logo_path),
    status: row.status,
    createdAt: row.created_at,
    students: students.count ?? 0,
    domains: domainRows.map((d) => d.hostname),
    domainRows,
    managers: (members.data ?? []).map((m) => ({ userId: m.user_id, name: m.display_name, role: m.role })),
  };
}

/** Where to open a school's portal from the admin area, keeping the KMF admin signed in where possible. */
export async function schoolPortalLink(slug: string): Promise<string> {
  const tenant = await getTenant();
  const onRoot = tenant.hostname === ROOT_DOMAIN || tenant.hostname === `www.${ROOT_DOMAIN}`;
  return onRoot ? `https://${slug}.${ROOT_DOMAIN}/login` : `/s/${slug}`;
}

/** The address a school uses when it has no domain of its own. */
export function platformAddress(slug: string): string {
  return `${slug}.${ROOT_DOMAIN}`;
}
