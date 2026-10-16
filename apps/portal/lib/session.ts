import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { MANAGER_ROLES, ROLES, displayLogin, type Role, type School } from "@kmf/core";
import { IS_DEMO } from "./env";
import { DEMO_PEOPLE, DEMO_ROLE_COOKIE, demoRole } from "./demo";
import { supabaseForRequest } from "./supabase";
import { requireSchool } from "./tenant";

export type Viewer = {
  userId: string;
  name: string;
  email: string | null;
  /** What this person types to sign in: email, admission number or phone. */
  login: string | null;
  /** The role this page is shown in. */
  role: Role;
  /** All roles this person holds at this school (e.g. a teacher who is also a parent). */
  roles: Role[];
  /** KMF Enterprise staff, who can manage every school on the platform. */
  isPlatformAdmin: boolean;
};

/** Highest-ranked role first: owner, admin, teacher, bursar, parent, student. */
function rank(roles: Role[]): Role[] {
  return [...roles].sort((a, b) => ROLES.indexOf(a) - ROLES.indexOf(b));
}

export function isManager(viewer: Viewer): boolean {
  return viewer.isPlatformAdmin || viewer.roles.some((r) => MANAGER_ROLES.includes(r));
}

/**
 * The signed-in person at this school, or null. Membership of another school does
 * not count, except for KMF admins, who act as the school's admin everywhere.
 */
export const getViewer = cache(async (school: School): Promise<Viewer | null> => {
  if (IS_DEMO) {
    const role = demoRole((await cookies()).get(DEMO_ROLE_COOKIE)?.value);
    if (!role) return null;
    const person = DEMO_PEOPLE[role];
    return { userId: `demo-${role}`, name: person.name, email: person.email || null, login: person.email || null, role, roles: [role], isPlatformAdmin: false };
  }

  const supabase = await supabaseForRequest();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;

  const [members, platform] = await Promise.all([
    supabase.from("school_members").select("role, display_name").eq("school_id", school.id).eq("user_id", userId),
    supabase.from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle(),
  ]);
  if (members.error) throw new Error(`Could not load your account: ${members.error.message}`);
  if (platform.error) throw new Error(`Could not load your account: ${platform.error.message}`);

  const isPlatformAdmin = Boolean(platform.data);
  const rows = members.data ?? [];
  if (rows.length === 0 && !isPlatformAdmin) return null;

  const rawEmail = typeof claims.claims.email === "string" ? claims.claims.email : null;
  const email = rawEmail && !rawEmail.endsWith(".accounts.kmfschools.ng") ? rawEmail : null;

  // KMF admins without a role at this school act as its admin.
  const roles = rows.length > 0 ? rank(rows.map((r) => r.role as Role)) : (["admin"] as Role[]);
  return {
    userId,
    name: rows[0]?.display_name ?? "KMF support",
    email,
    login: rawEmail ? displayLogin(rawEmail) : null,
    role: roles[0]!,
    roles: isPlatformAdmin && !roles.includes("admin") ? rank([...roles, "admin"]) : roles,
    isPlatformAdmin,
  };
});

/** For pages behind sign-in. Sends signed-out visitors to the login page. */
export async function requireViewer(allowed?: readonly Role[]): Promise<{ school: School; viewer: Viewer }> {
  const school = await requireSchool();
  const viewer = await getViewer(school);
  if (!viewer) redirect("/login");
  if (allowed && !viewer.roles.some((r) => allowed.includes(r))) redirect("/dashboard");
  return { school, viewer };
}
