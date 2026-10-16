import "server-only";
import type { Role } from "@kmf/core";
import type { adminClient } from "./admin";

export type Admin = NonNullable<ReturnType<typeof adminClient>>;

/** Creates the account, or finds it if this person already has one (a teacher who is also a parent). */
export async function ensureAccount(admin: Admin, email: string, password: string, meta: Record<string, string>): Promise<{ userId: string; created: boolean }> {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
  if (!error && data.user) return { userId: data.user.id, created: true };
  if (error && (error.code === "email_exists" || error.code === "user_already_exists" || error.status === 422)) {
    const { data: existing } = await admin.rpc("auth_user_id_by_email", { p_email: email } as never);
    if (typeof existing === "string") return { userId: existing, created: false };
  }
  throw new Error(error?.message ?? "Account could not be created");
}

export async function addMembership(admin: Admin, schoolId: string, userId: string, role: Role, displayName: string) {
  const { error } = await admin
    .from("school_members")
    .upsert({ school_id: schoolId, user_id: userId, role, display_name: displayName } as never, { onConflict: "school_id,user_id,role", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}
