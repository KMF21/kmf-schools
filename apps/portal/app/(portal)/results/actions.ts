"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { scoreProblem } from "@kmf/core";
import { friendly, managerContext, staffContext, type ActionState } from "@/lib/actions";
import { getPublishStatus } from "@/lib/billing";
import { getClassInfo, resolveTerm } from "@/lib/results";

const uuid = z.uuid();

/** Why a save failed, in words a teacher can act on. */
function resultError(error: { message: string; code?: string }, what: string): ActionState {
  if (error.code === "42501") {
    return { error: "You can't change these results. Either they're published (ask the school admin to unpublish), or this class or subject isn't assigned to you." };
  }
  if (error.code === "22023") return { error: error.message };
  return friendly(error, what);
}

/* ------------------------------------------------------------- Scores */

const scoreInput = z.object({
  termId: uuid,
  armId: uuid,
  subjectId: uuid,
  entries: z
    .array(z.object({ studentId: uuid, componentId: uuid, score: z.number().nullable() }))
    .min(1)
    .max(2000),
});

export type SaveResult = ActionState & { saved?: number };

export async function saveScores(input: z.infer<typeof scoreInput>): Promise<SaveResult> {
  const access = await staffContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;
  const parsed = scoreInput.safeParse(input);
  if (!parsed.success) return { error: "Some scores couldn't be read. Refresh the page and try again." };
  const { termId, armId, subjectId, entries } = parsed.data;

  const cls = await getClassInfo(school, armId);
  if (!cls || cls.style !== "score") return { error: "That class couldn't be found." };
  const components = new Map(cls.components.map((c) => [c.id, c]));
  for (const e of entries) {
    const c = components.get(e.componentId);
    if (!c) return { error: "The CA and exam setup has changed. Refresh the page." };
    if (e.score !== null) {
      const problem = scoreProblem(e.score, c);
      if (problem) return { error: problem };
    }
  }

  const base = { school_id: school.id, term_id: termId, class_arm_id: armId, subject_id: subjectId };
  const upserts = entries.filter((e) => e.score !== null).map((e) => ({ ...base, student_id: e.studentId, component_id: e.componentId, score: e.score }));
  const clears = entries.filter((e) => e.score === null);

  if (upserts.length) {
    const { error } = await supabase.from("scores").upsert(upserts, { onConflict: "term_id,student_id,subject_id,component_id" });
    if (error) return resultError(error, "scores");
  }
  for (const c of clears) {
    const { error } = await supabase
      .from("scores")
      .delete()
      .eq("school_id", school.id)
      .eq("term_id", termId)
      .eq("student_id", c.studentId)
      .eq("subject_id", subjectId)
      .eq("component_id", c.componentId);
    if (error) return resultError(error, "scores");
  }
  return { ok: "Saved.", saved: entries.length };
}

const ratingInput = z.object({
  termId: uuid,
  armId: uuid,
  subjectId: uuid,
  entries: z.array(z.object({ studentId: uuid, rating: z.string().trim().max(40).nullable() })).min(1).max(500),
});

export async function saveRatings(input: z.infer<typeof ratingInput>): Promise<SaveResult> {
  const access = await staffContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;
  const parsed = ratingInput.safeParse(input);
  if (!parsed.success) return { error: "Some ratings couldn't be read. Refresh the page and try again." };
  const { termId, armId, subjectId, entries } = parsed.data;

  const base = { school_id: school.id, term_id: termId, class_arm_id: armId, subject_id: subjectId };
  const upserts = entries.filter((e) => e.rating).map((e) => ({ ...base, student_id: e.studentId, rating: e.rating }));
  if (upserts.length) {
    const { error } = await supabase.from("ratings").upsert(upserts, { onConflict: "term_id,student_id,subject_id" });
    if (error) return resultError(error, "ratings");
  }
  for (const e of entries.filter((x) => !x.rating)) {
    const { error } = await supabase.from("ratings").delete().eq("school_id", school.id).eq("term_id", termId).eq("student_id", e.studentId).eq("subject_id", subjectId);
    if (error) return resultError(error, "ratings");
  }
  return { ok: "Saved.", saved: entries.length };
}

/* ---------------------------------------------- Attendance and comments */

export async function saveReport(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await staffContext();
  if ("error" in access) return access.error;
  const { school, supabase, viewer } = access.ctx;

  const ids = z.object({ termId: uuid, armId: uuid, studentId: uuid }).safeParse({
    termId: form.get("term_id"),
    armId: form.get("arm_id"),
    studentId: form.get("student_id"),
  });
  if (!ids.success) return { error: "That student couldn't be found. Refresh the page." };

  const term = await resolveTerm(school, ids.data.termId);
  const daysRaw = String(form.get("days_present") ?? "").trim();
  const days = daysRaw === "" ? null : Number(daysRaw);
  if (days !== null && (!Number.isInteger(days) || days < 0 || days > 200)) return { error: "Days present must be a whole number.", fields: { days_present: "Enter a whole number." } };
  if (days !== null && term?.daysOpen != null && days > term.daysOpen) {
    return { error: `The school opened for ${term.daysOpen} days this term.`, fields: { days_present: `At most ${term.daysOpen}.` } };
  }
  const teacherComment = String(form.get("teacher_comment") ?? "").trim().slice(0, 400) || null;

  const traits: Record<string, number> = {};
  for (const [key, value] of form.entries()) {
    if (!key.startsWith("trait:") || typeof value !== "string" || value === "") continue;
    const id = key.slice(6);
    const n = Number(value);
    if (uuid.safeParse(id).success && Number.isInteger(n) && n >= 1 && n <= 5) traits[id] = n;
  }

  const row: Record<string, unknown> = {
    school_id: school.id,
    term_id: ids.data.termId,
    class_arm_id: ids.data.armId,
    student_id: ids.data.studentId,
    days_present: days,
    teacher_comment: teacherComment,
    traits,
  };
  // Only managers send the head's comment; for others it stays as it is.
  const isManager = viewer.isPlatformAdmin || viewer.roles.some((r) => r === "owner" || r === "admin");
  if (isManager) row.head_comment = String(form.get("head_comment") ?? "").trim().slice(0, 400) || null;

  const { error } = await supabase.from("term_reports").upsert(row, { onConflict: "term_id,student_id" });
  if (error) return resultError(error, "report");
  revalidatePath(`/results/${ids.data.armId}`, "layout");
  return { ok: "Saved." };
}

/* ------------------------------------------------------------ Publishing */

const releaseInput = z.object({ termId: uuid, armId: uuid });

export async function publishClass(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;
  const parsed = releaseInput.safeParse({ termId: form.get("term_id"), armId: form.get("arm_id") });
  if (!parsed.success) return { error: "That class couldn't be found." };
  const { termId, armId } = parsed.data;

  const [cls, term] = await Promise.all([getClassInfo(school, armId), resolveTerm(school, termId)]);
  if (!cls || !term) return { error: "That class couldn't be found." };
  const billing = await getPublishStatus(school, term, access.ctx.viewer.isPlatformAdmin);
  if (!billing.allowed) return { error: billing.message ?? "Publishing is locked. Contact KMF support." };

  // Every student gets a report row, so each one appears for their parents.
  if (cls.students.length) {
    const rows = cls.students.map((s) => ({ school_id: school.id, term_id: termId, class_arm_id: armId, student_id: s.id }));
    const { error } = await supabase.from("term_reports").upsert(rows, { onConflict: "term_id,student_id", ignoreDuplicates: true });
    if (error) return resultError(error, "reports");
  }
  const { error } = await supabase.from("result_releases").insert({ school_id: school.id, term_id: termId, class_arm_id: armId });
  if (error?.code === "42501") return { error: "Publishing is locked until this term's KMF invoice is paid. Contact KMF support." };
  if (error && error.code !== "23505") return friendly(error, "results");
  revalidatePath("/results", "layout");
  return { ok: `${cls.label} results are published. Parents and students can now see them, and scores are locked.` };
}

export async function unpublishClass(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;
  const parsed = releaseInput.safeParse({ termId: form.get("term_id"), armId: form.get("arm_id") });
  if (!parsed.success) return { error: "That class couldn't be found." };
  const { error } = await supabase.from("result_releases").delete().eq("school_id", school.id).eq("term_id", parsed.data.termId).eq("class_arm_id", parsed.data.armId);
  if (error) return friendly(error, "results");
  revalidatePath("/results", "layout");
  return { ok: "Unpublished. Teachers can make changes again, and parents can't see these results until you publish again." };
}

/* -------------------------------------------------------------- Teachers */

const teachersInput = z.object({
  armId: uuid,
  formTeacherId: uuid.nullable(),
  assignments: z.array(z.object({ subjectId: uuid, staffId: uuid })).max(200),
});

export async function saveClassTeachers(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { supabase } = access.ctx;

  const assignments: Array<{ subjectId: string; staffId: string }> = [];
  for (const [key, value] of form.entries()) {
    if (key.startsWith("subject:") && typeof value === "string" && value) assignments.push({ subjectId: key.slice(8), staffId: value });
  }
  const parsed = teachersInput.safeParse({ armId: form.get("arm_id"), formTeacherId: (form.get("form_teacher") as string) || null, assignments });
  if (!parsed.success) return { error: "Some choices couldn't be read. Refresh the page and try again." };

  const { error } = await supabase.rpc("save_class_teachers", { p_arm: parsed.data.armId, p_form_teacher: parsed.data.formTeacherId, p_assignments: parsed.data.assignments });
  if (error) return friendly(error, "teachers");
  revalidatePath("/results", "layout");
  revalidatePath("/classes");
  return { ok: "Teachers saved." };
}
