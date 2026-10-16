"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { displayLogin, generatePassword, normalizePhone, phoneLoginEmail, studentLoginEmail, type Role } from "@kmf/core";
import { managerContext, friendly, type ActionState } from "@/lib/actions";
import { ADMIN_MISSING_MESSAGE, adminClient } from "@/lib/admin";
import { addMembership, ensureAccount, type Admin } from "@/lib/accounts";
import { getArmOptions } from "@/lib/people";

/* Credentials are returned once, to the manager who created them, and never stored or logged. */
export type Credential = { name: string; detail: string; login: string; password: string | null };
export type BatchResult = ActionState & { credentials?: Credential[]; remaining?: number; problems?: string[] };

export type LoginKind = "students" | "parents" | "staff";
const BATCH = 25;

export async function createLogins(kind: LoginKind): Promise<BatchResult> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school } = access.ctx;
  const admin = adminClient();
  if (!admin) return { error: ADMIN_MISSING_MESSAGE };
  if (!["students", "parents", "staff"].includes(kind)) return { error: "Choose who to create logins for." };

  const credentials: Credential[] = [];
  const problems: string[] = [];

  try {
    if (kind === "students") {
      const arms = await getArmOptions(school);
      const label = new Map(arms.map((a) => [a.id, a.label]));
      const { data, error } = await admin
        .from("students")
        .select("id, admission_no, first_name, last_name, class_arm_id")
        .eq("school_id", school.id)
        .eq("status", "active")
        .is("user_id", null)
        .order("admission_no")
        .limit(BATCH);
      if (error) return friendly(error, "students");
      for (const s of (data ?? []) as Array<{ id: string; admission_no: string; first_name: string; last_name: string; class_arm_id: string | null }>) {
        const name = `${s.first_name} ${s.last_name}`;
        const password = generatePassword();
        const account = await ensureAccount(admin, studentLoginEmail(s.admission_no, school.id), password, { school_id: school.id, display_name: name });
        await addMembership(admin, school.id, account.userId, "student", name);
        await admin.from("students").update({ user_id: account.userId } as never).eq("id", s.id).eq("school_id", school.id);
        credentials.push({ name, detail: (s.class_arm_id && label.get(s.class_arm_id)) || "Student", login: s.admission_no, password: account.created ? password : null });
      }
    }

    if (kind === "parents") {
      const { data, error } = await admin
        .from("guardians")
        .select("id, full_name, phone")
        .eq("school_id", school.id)
        .is("user_id", null)
        .not("phone", "is", null)
        .order("full_name")
        .limit(BATCH * 4); // extra, so a run of bad phone numbers can't stall the batch
      if (error) return friendly(error, "parents");
      for (const g of (data ?? []) as Array<{ id: string; full_name: string; phone: string }>) {
        if (credentials.length >= BATCH) break;
        const phone = normalizePhone(g.phone);
        if (!phone) {
          problems.push(`${g.full_name}: the phone number "${g.phone}" isn't valid.`);
          continue;
        }
        const password = generatePassword();
        const account = await ensureAccount(admin, phoneLoginEmail(phone, school.id), password, { school_id: school.id, display_name: g.full_name });
        await addMembership(admin, school.id, account.userId, "parent", g.full_name);
        // Link every parent record with this phone (the same person entered twice).
        await admin.from("guardians").update({ user_id: account.userId } as never).eq("school_id", school.id).eq("phone", g.phone).is("user_id", null);
        credentials.push({ name: g.full_name, detail: "Parent", login: phone, password: account.created ? password : null });
      }
    }

    if (kind === "staff") {
      const { data, error } = await admin
        .from("staff")
        .select("id, title, first_name, last_name, email, phone, position")
        .eq("school_id", school.id)
        .eq("is_active", true)
        .is("user_id", null)
        .or("email.not.is.null,phone.not.is.null")
        .order("last_name")
        .limit(BATCH * 4);
      if (error) return friendly(error, "staff");
      for (const s of (data ?? []) as Array<{ id: string; title: string | null; first_name: string; last_name: string; email: string | null; phone: string | null; position: string | null }>) {
        if (credentials.length >= BATCH) break;
        const name = [s.title, s.first_name, s.last_name].filter(Boolean).join(" ");
        const phone = s.phone ? normalizePhone(s.phone) : null;
        const email = s.email ? s.email.toLowerCase() : phone ? phoneLoginEmail(phone, school.id) : null;
        if (!email) {
          problems.push(`${name}: add an email or a valid phone number first.`);
          continue;
        }
        const password = generatePassword();
        const account = await ensureAccount(admin, email, password, { school_id: school.id, display_name: name });
        // Bursars get fee access; everyone else starts as a teacher. Promote to school admin on their staff page.
        const role: Role = /bursar|accountant/i.test(s.position ?? "") ? "bursar" : "teacher";
        await addMembership(admin, school.id, account.userId, role, name);
        await admin.from("staff").update({ user_id: account.userId } as never).eq("id", s.id).eq("school_id", school.id);
        credentials.push({ name, detail: s.position ?? "Staff", login: displayLogin(email), password: account.created ? password : null });
      }
    }
  } catch (e) {
    console.error("[kmf] create logins:", e instanceof Error ? e.message : e);
    return {
      error: "Some logins couldn't be created. Check your connection and try again; logins already created are kept.",
      credentials,
      problems,
    };
  }

  const remaining = await countWithoutLogin(admin, school.id, kind);
  revalidatePath("/logins");
  return { ok: `${credentials.length} logins created.`, credentials, remaining, problems };
}

async function countWithoutLogin(admin: Admin, schoolId: string, kind: LoginKind): Promise<number> {
  const table = kind === "students" ? "students" : kind === "parents" ? "guardians" : "staff";
  let q = admin.from(table).select("id", { count: "exact", head: true }).eq("school_id", schoolId).is("user_id", null);
  if (kind === "students") q = q.eq("status", "active");
  if (kind === "parents") q = q.not("phone", "is", null);
  if (kind === "staff") q = q.eq("is_active", true).or("email.not.is.null,phone.not.is.null");
  const { count } = await q;
  return count ?? 0;
}

/**
 * Gives someone a new password. The school office may reset accounts that only
 * exist for this school (admission-number and phone logins). Accounts that use a
 * personal email may be used elsewhere, so only KMF support can reset those.
 */
export async function resetPassword(kind: LoginKind, recordId: string): Promise<BatchResult> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, viewer } = access.ctx;
  const admin = adminClient();
  if (!admin) return { error: ADMIN_MISSING_MESSAGE };
  if (!z.uuid().safeParse(recordId).success) return { error: "That person couldn't be found." };

  const table = kind === "students" ? "students" : kind === "parents" ? "guardians" : "staff";
  const { data: record } = await admin.from(table).select("*").eq("id", recordId).eq("school_id", school.id).maybeSingle();
  const r = record as Record<string, string | null> | null;
  if (!r?.user_id) return { error: "This person doesn't have a login yet. Create logins first." };

  const { data: user, error: userError } = await admin.auth.admin.getUserById(r.user_id);
  if (userError || !user.user?.email) return { error: "That login couldn't be found." };
  const email = user.user.email.toLowerCase();
  const schoolScoped = email.endsWith(`@${school.id.toLowerCase()}.accounts.kmfschools.ng`);
  if (!schoolScoped && !viewer.isPlatformAdmin) {
    return { error: "This person signs in with their own email address, which may be used at other schools too. Ask KMF support to reset it." };
  }

  const password = generatePassword();
  const { error } = await admin.auth.admin.updateUserById(r.user_id, { password });
  if (error) return friendly(error, "password");

  const name = kind === "parents" ? (r.full_name ?? "Parent") : [r.title, r.first_name, r.last_name].filter(Boolean).join(" ");
  const login = kind === "students" ? (r.admission_no ?? displayLogin(email)) : displayLogin(email);
  return { ok: "New password created.", credentials: [{ name, detail: kind === "students" ? "Student" : kind === "parents" ? "Parent" : (r.position ?? "Staff"), login, password }] };
}

const STAFF_ROLES = ["teacher", "bursar", "admin"] as const;

export async function setStaffRole(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, viewer, supabase } = access.ctx;

  const staffId = z.uuid().safeParse(form.get("staff_id"));
  const role = z.enum(STAFF_ROLES).safeParse(form.get("role"));
  if (!staffId.success || !role.success) return { error: "Choose a portal role." };

  const { data: staff } = await supabase.from("staff").select("user_id, title, first_name, last_name").eq("id", staffId.data).eq("school_id", school.id).maybeSingle();
  if (!staff?.user_id) return { error: "Create this person's login first, then choose their role." };
  if (staff.user_id === viewer.userId) return { error: "You can't change your own role. Ask the proprietor or another school admin." };

  const name = [staff.title, staff.first_name, staff.last_name].filter(Boolean).join(" ");
  const del = await supabase.from("school_members").delete().eq("school_id", school.id).eq("user_id", staff.user_id).in("role", [...STAFF_ROLES]);
  if (del.error) return friendly(del.error, "role");
  const ins = await supabase.from("school_members").insert({ school_id: school.id, user_id: staff.user_id, role: role.data, display_name: name });
  if (ins.error) return friendly(ins.error, "role");

  revalidatePath(`/staff/${staffId.data}`);
  const labels = { teacher: "teacher", bursar: "bursar", admin: "school admin" };
  return { ok: `${name} now signs in as a ${labels[role.data]}.` };
}
