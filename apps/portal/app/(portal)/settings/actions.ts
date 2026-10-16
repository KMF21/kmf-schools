"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendly, managerContext, text, type ActionState } from "@/lib/actions";
import { ASSETS_BUCKET } from "@/lib/env";
import { forgetSchool } from "@/lib/tenant";

const details = z.object({
  name: z.string({ error: "Enter the school's name." }).min(2, "Enter the school's full name.").max(120, "Keep the name under 120 characters."),
  short_name: z.string().max(40, "Keep the short name under 40 characters.").nullable(),
  motto: z.string().max(120, "Keep the motto under 120 characters.").nullable(),
  address: z.string().max(200, "Keep the address under 200 characters.").nullable(),
  phone: z
    .string()
    .max(40)
    .regex(/^[+0-9 ()-]{7,}$/, "Enter a phone number using digits, spaces and + only.")
    .nullable(),
  email: z.email("Enter a valid email address, or leave it empty.").nullable(),
  brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Choose a colour, for example #1a8754."),
});

export async function saveSchoolDetails(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const parsed = details.safeParse({
    name: text(form, "name"),
    short_name: text(form, "short_name"),
    motto: text(form, "motto"),
    address: text(form, "address"),
    phone: text(form, "phone"),
    email: text(form, "email"),
    brand_color: (text(form, "brand_color") ?? "").toLowerCase(),
  });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return { error: "Some details need fixing. See the highlighted fields.", fields };
  }

  const { error } = await supabase.from("schools").update(parsed.data).eq("id", school.id);
  if (error) return friendly(error, "school details");

  forgetSchool(school.id);
  revalidatePath("/", "layout");
  return { ok: "School details saved." };
}

const LOGO_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export async function uploadLogo(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const file = form.get("logo");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a logo image to upload." };
  const ext = LOGO_TYPES[file.type];
  if (!ext) return { error: "Use a PNG, JPG or WebP image. Other file types can't be used as a logo." };
  if (file.size > MAX_LOGO_BYTES) return { error: "That image is larger than 2 MB. Use a smaller version of the logo." };

  const { data: current } = await supabase.from("schools").select("logo_path").eq("id", school.id).single();
  const path = `${school.id}/logo-${Date.now()}.${ext}`;
  const upload = await supabase.storage.from(ASSETS_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "31536000" });
  if (upload.error) {
    console.error("[kmf] logo upload:", upload.error.message);
    return { error: "The logo couldn't be uploaded. Check your connection and try again." };
  }

  const { error } = await supabase.from("schools").update({ logo_path: path }).eq("id", school.id);
  if (error) {
    await supabase.storage.from(ASSETS_BUCKET).remove([path]);
    return friendly(error, "logo");
  }
  if (current?.logo_path) await supabase.storage.from(ASSETS_BUCKET).remove([current.logo_path]);

  forgetSchool(school.id);
  revalidatePath("/", "layout");
  return { ok: "Logo updated. It now appears on the login page and the portal." };
}

export async function removeLogo(): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const { data: current } = await supabase.from("schools").select("logo_path").eq("id", school.id).single();
  const { error } = await supabase.from("schools").update({ logo_path: null }).eq("id", school.id);
  if (error) return friendly(error, "logo");
  if (current?.logo_path) await supabase.storage.from(ASSETS_BUCKET).remove([current.logo_path]);

  forgetSchool(school.id);
  revalidatePath("/", "layout");
  return { ok: "Logo removed. The portal shows your initials until you upload a new one." };
}
