import type { Role, School } from "@kmf/core";
import { ADMIN_AVAILABLE } from "./admin";
import { IS_DEMO } from "./env";
import { DEMO_STUDENTS } from "./demo";
import { supabaseForRequest } from "./supabase";
import { getTenant } from "./tenant";

export type LoginGroup = { total: number; withLogin: number };
export type LoginCounts = { students: LoginGroup; parents: LoginGroup; staff: LoginGroup; canCreate: boolean };

/** How many people in each group can sign in, and how many still need a login. */
export async function getLoginCounts(school: School): Promise<LoginCounts> {
  if (IS_DEMO) {
    return {
      students: { total: DEMO_STUDENTS.length, withLogin: DEMO_STUDENTS.length - 6 },
      parents: { total: 31, withLogin: 24 },
      staff: { total: 8, withLogin: 8 },
      canCreate: true, // buttons explain that the demo doesn't save
    };
  }
  const supabase = await supabaseForRequest();
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count, error } = await q;
    if (error) throw new Error(`Could not count logins: ${error.message}`);
    return count ?? 0;
  };
  const head = { count: "exact" as const, head: true };
  const [st, stIn, pa, paIn, sf, sfIn] = await Promise.all([
    count(supabase.from("students").select("id", head).eq("school_id", school.id).eq("status", "active")),
    count(supabase.from("students").select("id", head).eq("school_id", school.id).eq("status", "active").not("user_id", "is", null)),
    count(supabase.from("guardians").select("id", head).eq("school_id", school.id).not("phone", "is", null)),
    count(supabase.from("guardians").select("id", head).eq("school_id", school.id).not("phone", "is", null).not("user_id", "is", null)),
    count(supabase.from("staff").select("id", head).eq("school_id", school.id).eq("is_active", true).or("email.not.is.null,phone.not.is.null")),
    count(supabase.from("staff").select("id", head).eq("school_id", school.id).eq("is_active", true).not("user_id", "is", null)),
  ]);
  return {
    students: { total: st, withLogin: stIn },
    parents: { total: pa, withLogin: paIn },
    staff: { total: sf, withLogin: sfIn },
    canCreate: ADMIN_AVAILABLE,
  };
}

export type LoginStatus = { hasLogin: boolean; roles: Role[]; isSelf: boolean; canCreate: boolean };

/** Whether one student or staff member can sign in, and (for staff) as what. */
export async function getLoginStatus(school: School, table: "students" | "staff", id: string, viewerId: string): Promise<LoginStatus> {
  if (IS_DEMO) return { hasLogin: true, roles: table === "staff" ? ["teacher"] : ["student"], isSelf: false, canCreate: true };
  const supabase = await supabaseForRequest();
  const { data } = await supabase.from(table).select("user_id").eq("school_id", school.id).eq("id", id).maybeSingle();
  const userId = (data as { user_id: string | null } | null)?.user_id ?? null;
  if (!userId) return { hasLogin: false, roles: [], isSelf: false, canCreate: ADMIN_AVAILABLE };
  const { data: members } = await supabase.from("school_members").select("role").eq("school_id", school.id).eq("user_id", userId);
  return { hasLogin: true, roles: (members ?? []).map((m) => m.role as Role), isSelf: userId === viewerId, canCreate: ADMIN_AVAILABLE };
}

/** The address printed on login slips: where people go to sign in. */
export async function getPortalAddress(school: School): Promise<string> {
  const tenant = await getTenant();
  if (tenant.kind !== "school") return "";
  return tenant.chosenByPath ? `${tenant.hostname}/s/${school.slug}` : tenant.hostname;
}
