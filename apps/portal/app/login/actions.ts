"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isRole, loginCandidates } from "@kmf/core";
import { IS_DEMO } from "@/lib/env";
import { DEMO_ROLE_COOKIE } from "@/lib/demo";
import { supabaseForRequest } from "@/lib/supabase";
import { getTenant } from "@/lib/tenant";

export type LoginState = { error?: string; identifier?: string };

const schema = z.object({
  identifier: z.string().trim().min(1, "Enter your email, admission number or phone number.").max(200),
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
  // An all-digit entry could be an admission number or a phone number, so try each.
  let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["data"] = { user: null, session: null };
  let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>["error"] = null;
  for (const email of loginCandidates(parsed.data.identifier, school.id)) {
    ({ data, error } = await supabase.auth.signInWithPassword({ email, password: parsed.data.password }));
    if (!error && data.user) break;
    if (error?.status === 429) break;
  }

  if (error || !data.user) {
    const tooMany = error?.status === 429;
    return {
      identifier,
      error: tooMany
        ? "Too many sign-in attempts. Wait a few minutes, then try again."
        : "Those sign-in details don't match. Check your email, admission number or phone number, and your password.",
    };
  }

  // An account only works at the schools it belongs to (KMF admins work everywhere).
  const [{ data: membership }, { data: platform }] = await Promise.all([
    supabase.from("school_members").select("id").eq("school_id", school.id).eq("user_id", data.user.id).limit(1),
    supabase.from("platform_admins").select("user_id").eq("user_id", data.user.id).maybeSingle(),
  ]);
  if ((!membership || membership.length === 0) && !platform) {
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
