"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { validateScale } from "@kmf/core";
import { friendly, managerContext, text, type ActionState } from "@/lib/actions";

const components = z
  .array(
    z.object({
      id: z.uuid().nullable(),
      name: z.string().trim().min(1, "Every CA or exam needs a name.").max(30, "Keep CA and exam names under 30 characters."),
      maxScore: z.number().positive("Each CA or exam must be worth more than 0.").max(100),
    }),
  )
  .min(1, "Add at least one CA or exam.")
  .max(8, "Use at most 8 CAs and exams.");

const bands = z
  .array(
    z.object({
      min: z.number().int().min(0).max(100),
      max: z.number().int().min(0).max(100),
      grade: z.string().trim().min(1, "Every grade needs a label, such as A1.").max(4, "Keep grade labels to 4 characters, such as A1."),
      remark: z.string().trim().max(30, "Keep remarks under 30 characters."),
    }),
  )
  .min(2, "Add at least two grades.")
  .max(15);

function parseJson(value: string | null): unknown {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function saveGrading(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const sectionId = z.uuid().safeParse(text(form, "section_id"));
  if (!sectionId.success) return { error: "That section couldn't be found." };

  const comps = components.safeParse(parseJson(text(form, "components")));
  if (!comps.success) return { error: comps.error.issues[0]?.message ?? "Check the CA and exam scores." };
  const total = comps.data.reduce((n, c) => n + c.maxScore, 0);
  if (Math.abs(total - 100) > 0.001) return { error: `CA and exam scores must add up to 100. They add up to ${total} now.` };
  const names = comps.data.map((c) => c.name.toLowerCase());
  if (new Set(names).size !== names.length) return { error: "Each CA or exam needs a different name." };

  const scale = bands.safeParse(parseJson(text(form, "bands")));
  if (!scale.success) return { error: scale.error.issues[0]?.message ?? "Check the grades." };
  const problems = validateScale(scale.data);
  if (problems.length > 0) return { error: problems[0] };
  const sorted = [...scale.data].sort((a, b) => b.min - a.min);

  // Make sure the section belongs to this school before changing anything under it.
  const { data: section } = await supabase.from("sections").select("id").eq("id", sectionId.data).eq("school_id", school.id).maybeSingle();
  if (!section) return { error: "That section couldn't be found." };

  // One database call, so it either saves completely or not at all.
  const { error } = await supabase.rpc("save_grading", {
    p_section: sectionId.data,
    p_components: comps.data,
    p_scale_name: text(form, "scale_name") ?? "Grading scale",
    p_bands: sorted,
  });
  if (error) return friendly(error, "grading");

  revalidatePath("/settings/grading");
  revalidatePath("/dashboard");
  return { ok: "Grading saved." };
}
