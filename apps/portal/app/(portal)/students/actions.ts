"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nameCase, parseDate, parseEmail, parsePhone } from "@kmf/core";
import { friendly, managerContext, text, type ActionState } from "@/lib/actions";

const name = (what: string) =>
  z
    .string({ error: `Enter the ${what}.` })
    .min(1, `Enter the ${what}.`)
    .max(60, `Keep the ${what} under 60 characters.`)
    .transform(nameCase);

const studentForm = z.object({
  admission_no: z.string({ error: "Enter the admission number." }).min(1, "Enter the admission number.").max(40, "Keep the admission number under 40 characters."),
  first_name: name("first name"),
  middle_name: z.string().max(60).transform(nameCase).nullable(),
  last_name: name("surname"),
  gender: z.enum(["male", "female"]).nullable(),
  date_of_birth: z.string().nullable(),
  class_arm_id: z.uuid().nullable(),
  status: z.enum(["active", "graduated", "withdrawn", "suspended"]),
  guardian_name: z.string().max(100).nullable(),
  guardian_phone: z.string().max(30).nullable(),
  guardian_email: z.string().max(120).nullable(),
  relationship: z.string().max(30).nullable(),
});

function fieldErrors(issues: z.core.$ZodIssue[]): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of issues) fields[String(issue.path[0])] ??= issue.message;
  return fields;
}

export async function saveStudent(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const id = text(form, "id");
  if (id && !z.uuid().safeParse(id).success) return { error: "That student couldn't be found." };

  const parsed = studentForm.safeParse({
    admission_no: text(form, "admission_no"),
    first_name: text(form, "first_name"),
    middle_name: text(form, "middle_name"),
    last_name: text(form, "last_name"),
    gender: text(form, "gender"),
    date_of_birth: text(form, "date_of_birth"),
    class_arm_id: text(form, "class_arm_id"),
    status: text(form, "status") ?? "active",
    guardian_name: text(form, "guardian_name"),
    guardian_phone: text(form, "guardian_phone"),
    guardian_email: text(form, "guardian_email"),
    relationship: text(form, "relationship"),
  });
  if (!parsed.success) return { error: "Some details need fixing.", fields: fieldErrors(parsed.error.issues) };
  const v = parsed.data;

  const fields: Record<string, string> = {};
  const dob = parseDate(v.date_of_birth);
  if (dob === "invalid") fields.date_of_birth = "Enter a valid date of birth.";
  const phone = parsePhone(v.guardian_phone);
  if (phone === "invalid") fields.guardian_phone = "Enter a valid phone number, for example 08031234567.";
  const email = parseEmail(v.guardian_email);
  if (email === "invalid") fields.guardian_email = "Enter a valid email address.";
  if (Object.keys(fields).length > 0) return { error: "Some details need fixing.", fields };

  const row = {
    admission_no: v.admission_no,
    first_name: v.first_name,
    middle_name: v.middle_name,
    last_name: v.last_name,
    gender: v.gender,
    date_of_birth: dob as string | null,
    class_arm_id: v.class_arm_id,
    status: v.status,
  };

  let studentId = id;
  if (id) {
    const { error } = await supabase.from("students").update(row).eq("id", id).eq("school_id", school.id);
    if (error) return error.code === "23505" ? { error: "Another student already has that admission number.", fields: { admission_no: "Already in use." } } : friendly(error, "student");
  } else {
    const { data, error } = await supabase.from("students").insert({ ...row, school_id: school.id }).select("id").single();
    if (error) return error.code === "23505" ? { error: "Another student already has that admission number.", fields: { admission_no: "Already in use." } } : friendly(error, "student");
    studentId = data.id;
  }

  // Parent or guardian: update the linked one, or find by phone, or create.
  const guardianId = text(form, "guardian_id");
  if (v.guardian_name || phone) {
    const guardianRow = { full_name: v.guardian_name ? nameCase(v.guardian_name) : `Parent of ${v.first_name}`, phone: phone as string | null, email: email as string | null };
    let gid = guardianId && z.uuid().safeParse(guardianId).success ? guardianId : null;
    if (gid) {
      const { error } = await supabase.from("guardians").update(guardianRow).eq("id", gid).eq("school_id", school.id);
      if (error) return friendly(error, "parent details");
    } else {
      if (phone) {
        const { data: found } = await supabase.from("guardians").select("id").eq("school_id", school.id).eq("phone", phone as string).limit(1).maybeSingle();
        gid = found?.id ?? null;
      }
      if (!gid) {
        const { data, error } = await supabase.from("guardians").insert({ ...guardianRow, school_id: school.id }).select("id").single();
        if (error) return friendly(error, "parent details");
        gid = data.id;
      }
    }
    const link = await supabase
      .from("student_guardians")
      .upsert({ school_id: school.id, student_id: studentId!, guardian_id: gid, relationship: v.relationship }, { onConflict: "student_id,guardian_id" });
    if (link.error) return friendly(link.error, "parent link");
  }

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidatePath("/classes");
  if (!id) redirect(`/students/${studentId}?added=1`);
  return { ok: "Student details saved." };
}

const importRow = z.object({
  admission_no: z.string().min(1).max(40),
  first_name: z.string().min(1).max(60),
  middle_name: z.string().max(60).nullable(),
  last_name: z.string().min(1).max(60),
  gender: z.enum(["male", "female"]).nullable(),
  date_of_birth: z.iso.date().nullable(),
  class_arm_id: z.uuid().nullable(),
  guardian_name: z.string().max(100).nullable(),
  guardian_phone: z.string().regex(/^\+?\d{7,15}$/).nullable(),
  guardian_email: z.email().nullable(),
});

export type ImportResult = ActionState & { created?: number; updated?: number; skipped?: number; guardians?: number };

export async function importStudents(rows: unknown, updateExisting: boolean): Promise<ImportResult> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const parsed = z.array(importRow).min(1, "There are no students to import.").max(5000, "Import at most 5,000 students at a time.").safeParse(rows);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Some rows couldn't be read. Check the file and try again." };

  const { data, error } = await supabase.rpc("import_students", { p_school: school.id, p_rows: parsed.data, p_update_existing: updateExisting });
  if (error) {
    if (error.code === "23503") return { error: "Some students are assigned to a class that no longer exists. Reload the page and try again." };
    return friendly(error, "import");
  }

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidatePath("/classes");
  const r = data as { created: number; updated: number; skipped: number; guardians: number };
  return { ok: "Import finished.", ...r };
}
