"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BASIC_SCALE, DEFAULT_COMPONENTS, SECTION_KINDS, SECTION_TEMPLATES, WAEC_SCALE } from "@kmf/core";
import { friendly, managerContext, text, type ActionState } from "@/lib/actions";
import type { supabaseForRequest } from "@/lib/supabase";

const uuid = z.uuid();
const NAME = /^[\p{L}\p{N} .'()/&-]{1,40}$/u;

function done(message: string): ActionState {
  revalidatePath("/classes");
  revalidatePath("/dashboard");
  revalidatePath("/settings/grading");
  return { ok: message };
}

function cleanName(value: string | null, what: string): { name: string } | { error: ActionState } {
  const name = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!name) return { error: { error: `Enter a name for the ${what}.` } };
  if (!NAME.test(name)) return { error: { error: `Keep the ${what} name under 40 characters, using letters, numbers and simple punctuation.` } };
  return { name };
}

/* ---------------------------------------------------------------- Sections */

export async function addSection(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const kind = z.enum(SECTION_KINDS).safeParse(text(form, "kind"));
  if (!kind.success) return { error: "Choose a section to add." };
  const t = SECTION_TEMPLATES[kind.data];
  const scored = t.assessmentStyle === "score";

  const { error } = await supabase.rpc("setup_section", {
    p_school: school.id,
    p_kind: t.kind,
    p_name: t.name,
    p_style: t.assessmentStyle,
    p_levels: t.classLevels,
    p_arms: ["A"],
    p_subjects: t.subjects,
    p_electives: t.electives ?? {},
    p_components: scored ? DEFAULT_COMPONENTS : [],
    p_scale_name: scored ? (t.kind === "senior_secondary" ? "WAEC scale" : "Standard scale") : null,
    p_scale: scored ? (t.kind === "senior_secondary" ? WAEC_SCALE : BASIC_SCALE) : null,
  });
  if (error) {
    if (error.code === "23505") return { error: `${t.name} is already set up, or one of its class names is already in use.` };
    return friendly(error, "section");
  }
  return done(`${t.name} added with ${t.classLevels.length} classes and its starter subjects. Edit them below to match your school.`);
}

export async function setSectionEnabled(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const id = uuid.safeParse(text(form, "id"));
  if (!id.success) return { error: "That section couldn't be found." };
  const enabled = text(form, "enabled") === "true";

  const { error } = await supabase.from("sections").update({ is_enabled: enabled }).eq("id", id.data).eq("school_id", school.id);
  if (error) return friendly(error, "section");
  return done(enabled ? "Section turned on." : "Section turned off. Its classes are hidden but nothing is deleted.");
}

/* ----------------------------------------------------------------- Classes */

type Db = Awaited<ReturnType<typeof supabaseForRequest>>;

async function studentsIn(supabase: Db, schoolId: string, armIds: string[]) {
  if (armIds.length === 0) return 0;
  const { count } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("school_id", schoolId).in("class_arm_id", armIds);
  return count ?? 0;
}

export async function addClassLevel(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const sectionId = uuid.safeParse(text(form, "section_id"));
  if (!sectionId.success) return { error: "That section couldn't be found." };
  const named = cleanName(text(form, "name"), "class");
  if ("error" in named) return named.error;

  const { data: last } = await supabase
    .from("class_levels")
    .select("sort_order")
    .eq("school_id", school.id)
    .eq("section_id", sectionId.data)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: level, error } = await supabase
    .from("class_levels")
    .insert({ school_id: school.id, section_id: sectionId.data, name: named.name, sort_order: (last?.sort_order ?? 0) + 1 })
    .select("id")
    .single();
  if (error) return friendly(error, "class");

  const arm = await supabase.from("class_arms").insert({ school_id: school.id, class_level_id: level.id, name: "A" });
  if (arm.error) return friendly(arm.error, "class arm");
  return done(`${named.name} added with arm A. Choose its subjects next.`);
}

export async function renameClassLevel(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const id = uuid.safeParse(text(form, "id"));
  if (!id.success) return { error: "That class couldn't be found." };
  const named = cleanName(text(form, "name"), "class");
  if ("error" in named) return named.error;

  const { error } = await supabase.from("class_levels").update({ name: named.name }).eq("id", id.data).eq("school_id", school.id);
  if (error) return friendly(error, "class");
  return done(`Renamed to ${named.name}.`);
}

export async function deleteClassLevel(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const id = uuid.safeParse(text(form, "id"));
  if (!id.success) return { error: "That class couldn't be found." };

  const { data: arms } = await supabase.from("class_arms").select("id").eq("school_id", school.id).eq("class_level_id", id.data);
  const enrolled = await studentsIn(supabase, school.id, (arms ?? []).map((a) => a.id));
  if (enrolled > 0) return { error: `This class has ${enrolled} student${enrolled === 1 ? "" : "s"}. Move them to another class first.` };

  const { error } = await supabase.from("class_levels").delete().eq("id", id.data).eq("school_id", school.id);
  if (error) return friendly(error, "class");
  return done("Class removed.");
}

/* -------------------------------------------------------------------- Arms */

export async function addArm(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const levelId = uuid.safeParse(text(form, "level_id"));
  if (!levelId.success) return { error: "That class couldn't be found." };
  const named = cleanName(text(form, "name"), "arm");
  if ("error" in named) return named.error;

  const { error } = await supabase.from("class_arms").insert({ school_id: school.id, class_level_id: levelId.data, name: named.name });
  if (error) return friendly(error, "arm");
  return done(`Arm ${named.name} added.`);
}

export async function deleteArm(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const id = uuid.safeParse(text(form, "id"));
  if (!id.success) return { error: "That arm couldn't be found." };

  const { data: arm } = await supabase.from("class_arms").select("id, class_level_id").eq("id", id.data).eq("school_id", school.id).maybeSingle();
  if (!arm) return { error: "That arm couldn't be found." };
  const { count: siblings } = await supabase.from("class_arms").select("id", { count: "exact", head: true }).eq("school_id", school.id).eq("class_level_id", arm.class_level_id);
  if ((siblings ?? 0) <= 1) return { error: "A class needs at least one arm. Remove the whole class instead." };
  const enrolled = await studentsIn(supabase, school.id, [id.data]);
  if (enrolled > 0) return { error: `This arm has ${enrolled} student${enrolled === 1 ? "" : "s"}. Move them first.` };

  const { error } = await supabase.from("class_arms").delete().eq("id", id.data).eq("school_id", school.id);
  if (error) return friendly(error, "arm");
  return done("Arm removed.");
}

/* ---------------------------------------------------------------- Subjects */

export async function saveClassSubjects(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const levelId = uuid.safeParse(text(form, "level_id"));
  if (!levelId.success) return { error: "That class couldn't be found." };

  const chosen = new Set(form.getAll("subject").filter((v): v is string => typeof v === "string" && uuid.safeParse(v).success));

  // New subjects typed in, one per line or comma-separated.
  const typed = (text(form, "new_subjects") ?? "")
    .split(/[\n,]/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  for (const name of typed) {
    if (!NAME.test(name)) return { error: `"${name}" isn't a valid subject name. Keep names under 40 characters.` };
  }
  if (typed.length > 0) {
    const { data: created, error } = await supabase
      .from("subjects")
      .upsert(typed.map((name) => ({ school_id: school.id, name, is_active: true })), { onConflict: "school_id,name" })
      .select("id");
    if (error) return friendly(error, "subject");
    for (const s of created ?? []) chosen.add(s.id);
  }

  const { data: existing, error: loadError } = await supabase.from("class_subjects").select("subject_id").eq("school_id", school.id).eq("class_level_id", levelId.data);
  if (loadError) return friendly(loadError, "class subjects");
  const current = new Set((existing ?? []).map((r) => r.subject_id));

  const toRemove = [...current].filter((id) => !chosen.has(id));
  const toAdd = [...chosen].filter((id) => !current.has(id));

  if (toRemove.length > 0) {
    const { error } = await supabase.from("class_subjects").delete().eq("school_id", school.id).eq("class_level_id", levelId.data).in("subject_id", toRemove);
    if (error) return friendly(error, "class subjects");
  }
  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("class_subjects")
      .insert(toAdd.map((subject_id, i) => ({ school_id: school.id, class_level_id: levelId.data, subject_id, sort_order: current.size + i + 1 })));
    if (error) return friendly(error, "class subjects");
  }

  return done(`Subjects saved: ${chosen.size} for this class.`);
}
