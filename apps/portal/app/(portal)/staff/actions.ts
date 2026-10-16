"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nameCase, parseEmail, parsePhone } from "@kmf/core";
import { friendly, managerContext, text, type ActionState } from "@/lib/actions";

const staffForm = z.object({
  title: z.string().max(20).nullable(),
  first_name: z.string({ error: "Enter the first name." }).min(1, "Enter the first name.").max(60).transform(nameCase),
  last_name: z.string({ error: "Enter the surname." }).min(1, "Enter the surname.").max(60).transform(nameCase),
  email: z.string().max(120).nullable(),
  phone: z.string().max(30).nullable(),
  position: z.string().max(80, "Keep the position under 80 characters.").nullable(),
  is_active: z.boolean(),
});

export async function saveStaff(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const id = text(form, "id");
  if (id && !z.uuid().safeParse(id).success) return { error: "That staff member couldn't be found." };

  const parsed = staffForm.safeParse({
    title: text(form, "title"),
    first_name: text(form, "first_name"),
    last_name: text(form, "last_name"),
    email: text(form, "email"),
    phone: text(form, "phone"),
    position: text(form, "position"),
    is_active: text(form, "is_active") !== "false",
  });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return { error: "Some details need fixing.", fields };
  }
  const v = parsed.data;
  const email = parseEmail(v.email);
  const phone = parsePhone(v.phone);
  const fields: Record<string, string> = {};
  if (email === "invalid") fields.email = "Enter a valid email address.";
  if (phone === "invalid") fields.phone = "Enter a valid phone number, for example 08031234567.";
  if (Object.keys(fields).length > 0) return { error: "Some details need fixing.", fields };

  const row = { title: v.title, first_name: v.first_name, last_name: v.last_name, email: email as string | null, phone: phone as string | null, position: v.position, is_active: v.is_active };

  let staffId = id;
  if (id) {
    const { error } = await supabase.from("staff").update(row).eq("id", id).eq("school_id", school.id);
    if (error) return friendly(error, "staff member");
  } else {
    if (email) {
      const { data: existing } = await supabase.from("staff").select("id").eq("school_id", school.id).ilike("email", email as string).limit(1).maybeSingle();
      if (existing) return { error: "A staff member with that email is already on the list.", fields: { email: "Already in use." } };
    }
    const { data, error } = await supabase.from("staff").insert({ ...row, school_id: school.id }).select("id").single();
    if (error) return friendly(error, "staff member");
    staffId = data.id;
  }

  revalidatePath("/staff");
  revalidatePath("/dashboard");
  if (!id) redirect(`/staff/${staffId}?added=1`);
  return { ok: "Staff details saved." };
}

const importRow = z.object({
  title: z.string().max(20).nullable(),
  first_name: z.string().min(1).max(60),
  last_name: z.string().min(1).max(60),
  email: z.email().nullable(),
  phone: z.string().regex(/^\+?\d{7,15}$/).nullable(),
  position: z.string().max(80).nullable(),
});

export async function importStaff(rows: unknown): Promise<ActionState & { created?: number; skipped?: number }> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const parsed = z.array(importRow).min(1, "There are no staff to import.").max(1000, "Import at most 1,000 staff at a time.").safeParse(rows);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Some rows couldn't be read. Check the file and try again." };

  const { data, error } = await supabase.rpc("import_staff", { p_school: school.id, p_rows: parsed.data });
  if (error) return friendly(error, "import");

  revalidatePath("/staff");
  revalidatePath("/dashboard");
  const r = data as { created: number; skipped: number };
  return { ok: "Import finished.", ...r };
}
