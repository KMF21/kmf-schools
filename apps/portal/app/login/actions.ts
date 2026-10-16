"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isRole, resolveLoginIdentifier } from "@kmf/core";
import { IS_DEMO } from "@/lib/env";
import { DEMO_ROLE_COOKIE } from "@/lib/demo";
import { supabaseForRequest } from "@/lib/supabase";
import { getTenant } from "@/lib/tenant";

export type LoginState = { error?: string; identifier?: string };

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your email or admission number.").max(200),
  password: z.string().min(1, "Enter your password.").max(200),
});

export async function signIn(_prev: LoginState, form: FormData): Promise<LoginState> {
  const tenant = await getTenant();
  if (tenant.kind !== "school") return { error: "Open your school's portal address to sign in." };
  const school = tenant.school;

  const parsed = schema.safeParse({ identifier: form.get("identifier"), password: form.get("password") });
  const identifier = String(form.get("identifier") ?? "");
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, identifier };

  const supabase = await supabaseForRequest();
  const { email } = resolveLoginIdentifier(parsed.data.identifier, school.id);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password });

  if (error || !data.user) {
    const tooMany = error?.status === 429;
    return {
      identifier,
      error: tooMany
        ? "Too many sign-in attempts. Wait a few minutes, then try again."
        : "That email or admission number and password don't match. Check both and try again.",
    };
  }

  // An account only works at the schools it belongs to.
  const { data: membership } = await supabase
    .from("school_members")
    .select("id")
    .eq("school_id", school.id)
    .eq("user_id", data.user.id)
    .limit(1);
  if (!membership || membership.length === 0) {
    await supabase.auth.signOut();
    return { identifier, error: `This account isn't registered at ${school.name}. Contact the school office.` };
  }

  redirect("/dashboard");
}

/** Demo mode only: sign in as one of the sample people. */
export async function signInAsDemo(form: FormData): Promise<void> {
  if (!IS_DEMO) redirect("/login");
  const role = form.get("role");
  if (!isRole(role)) redirect("/login");
  (await cookies()).set(DEMO_ROLE_COOKIE, role, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  if (IS_DEMO) {
    (await cookies()).delete(DEMO_ROLE_COOKIE);
  } else {
    const supabase = await supabaseForRequest();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
