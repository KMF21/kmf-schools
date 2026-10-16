"use server";

import type { ActionState } from "@/lib/actions";
import { IS_DEMO } from "@/lib/env";
import { supabaseForRequest } from "@/lib/supabase";

export async function changeOwnPassword(_prev: ActionState, form: FormData): Promise<ActionState> {
  if (IS_DEMO) return { error: "This is the demo school, so passwords can't be changed." };

  const password = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters.", fields: { password: "Use at least 8 characters." } };
  if (password.length > 72) return { error: "Use at most 72 characters.", fields: { password: "Too long." } };
  if (password !== confirm) return { error: "The two passwords don't match.", fields: { confirm: "Doesn't match." } };

  const supabase = await supabaseForRequest();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return { error: "Your session has ended. Sign in again, then retry." };

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "same_password") return { error: "That's your current password. Choose a new one." };
    if (error.code === "weak_password") return { error: "That password is too easy to guess. Use a longer one, with letters and numbers." };
    if (error.code === "reauthentication_needed") return { error: "For your security, sign out and sign in again, then change your password." };
    console.error("[kmf] change password:", error.message);
    return { error: "Your password couldn't be changed. Check your connection and try again." };
  }
  return { ok: "Password changed. Use the new one next time you sign in." };
}
