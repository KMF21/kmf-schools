"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendly, managerContext, text, type ActionState } from "@/lib/actions";

const date = z.iso.date({ error: "Enter a valid date." }).nullable();

const termForm = z
  .object({
    session: z.string({ error: "Enter the session, for example 2026/2027." }).regex(/^\d{4}\/\d{4}$/, "Write the session as two years, for example 2026/2027."),
    term: z.coerce.number().int().min(1).max(3),
    starts: date,
    ends: date,
    next: date,
  })
  .refine((v) => !v.starts || !v.ends || v.starts < v.ends, { path: ["ends"], message: "The term must end after it starts." })
  .refine((v) => !v.ends || !v.next || v.next > v.ends, { path: ["next"], message: "Next term must begin after this term ends." })
  .refine((v) => Number(v.session.slice(5)) === Number(v.session.slice(0, 4)) + 1, { path: ["session"], message: "The second year should follow the first, for example 2026/2027." });

export async function saveCurrentTerm(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const parsed = termForm.safeParse({
    session: text(form, "session"),
    term: text(form, "term"),
    starts: text(form, "starts"),
    ends: text(form, "ends"),
    next: text(form, "next"),
  });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return { error: "Check the highlighted fields.", fields };
  }

  const v = parsed.data;
  const { error } = await supabase.rpc("set_current_term", {
    p_school: school.id,
    p_session: v.session,
    p_term: v.term,
    p_starts: v.starts,
    p_ends: v.ends,
    p_next: v.next,
  });
  if (error) return friendly(error, "term");

  revalidatePath("/", "layout");
  const names = ["First", "Second", "Third"];
  return { ok: `${names[v.term - 1]} term of ${v.session} is now the current term.` };
}
