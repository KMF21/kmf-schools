"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendly, managerContext, text, type ActionState } from "@/lib/actions";
import { ASSETS_BUCKET } from "@/lib/env";

const done = () => {
  revalidatePath("/settings/reports");
  revalidatePath("/results", "layout");
};

export async function saveReportSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const headTitle = text(form, "head_title") ?? "Head teacher";
  const headName = text(form, "head_name");
  if (headTitle.length > 40) return { error: "Keep the title under 40 characters.", fields: { head_title: "Too long." } };
  if (headName && headName.length > 80) return { error: "Keep the name under 80 characters.", fields: { head_name: "Too long." } };

  const { data: current, error: readError } = await supabase.from("schools").select("settings").eq("id", school.id).single();
  if (readError) return friendly(readError, "report card settings");
  const settings = { ...((current?.settings as Record<string, unknown>) ?? {}), report: { showPosition: form.get("show_position") === "on", headTitle, headName } };
  const { error } = await supabase.from("schools").update({ settings }).eq("id", school.id);
  if (error) return friendly(error, "report card settings");
  done();
  return { ok: "Report card settings saved." };
}

const STAMP_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function uploadStamp(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;
  const file = form.get("stamp");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image of the stamp." };
  const ext = STAMP_TYPES[file.type];
  if (!ext) return { error: "Use a PNG, JPG or WebP image." };
  if (file.size > 1024 * 1024) return { error: "That image is larger than 1 MB. Use a smaller photo or scan." };

  const { data: current } = await supabase.from("schools").select("stamp_path").eq("id", school.id).single();
  const path = `${school.id}/stamp-${Date.now()}.${ext}`;
  const upload = await supabase.storage.from(ASSETS_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (upload.error) {
    console.error("[kmf] stamp upload:", upload.error.message);
    return { error: "The stamp couldn't be uploaded. Check your connection and try again." };
  }
  const { error } = await supabase.from("schools").update({ stamp_path: path }).eq("id", school.id);
  if (error) {
    await supabase.storage.from(ASSETS_BUCKET).remove([path]);
    return friendly(error, "stamp");
  }
  if (current?.stamp_path) await supabase.storage.from(ASSETS_BUCKET).remove([current.stamp_path]);
  done();
  return { ok: "Stamp saved. It appears beside the head's comment on report cards." };
}

export async function removeStamp(): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;
  const { data: current } = await supabase.from("schools").select("stamp_path").eq("id", school.id).single();
  const { error } = await supabase.from("schools").update({ stamp_path: null }).eq("id", school.id);
  if (error) return friendly(error, "stamp");
  if (current?.stamp_path) await supabase.storage.from(ASSETS_BUCKET).remove([current.stamp_path]);
  done();
  return { ok: "Stamp removed." };
}

export async function addTrait(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;
  const name = text(form, "name");
  const kind = z.enum(["behaviour", "skill"]).safeParse(form.get("kind"));
  if (!name || name.length > 60) return { error: "Enter a name under 60 characters.", fields: { name: "Required." } };
  if (!kind.success) return { error: "Choose behaviour or skill." };
  const { count } = await supabase.from("report_traits").select("id", { count: "exact", head: true }).eq("school_id", school.id);
  const { error } = await supabase.from("report_traits").insert({ school_id: school.id, kind: kind.data, name, sort_order: (count ?? 0) + 1 });
  if (error) return friendly(error, "item");
  done();
  return { ok: `${name} added.` };
}

export async function renameTrait(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;
  const id = z.uuid().safeParse(form.get("id"));
  const name = text(form, "name");
  if (!id.success || !name || name.length > 60) return { error: "Enter a name under 60 characters." };
  const { error } = await supabase.from("report_traits").update({ name }).eq("id", id.data).eq("school_id", school.id);
  if (error) return friendly(error, "item");
  done();
  return { ok: "Saved." };
}

export async function deleteTrait(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;
  const id = z.uuid().safeParse(form.get("id"));
  if (!id.success) return { error: "That item couldn't be found." };
  const { error } = await supabase.from("report_traits").delete().eq("id", id.data).eq("school_id", school.id);
  if (error) return friendly(error, "item");
  done();
  return { ok: "Removed." };
}
