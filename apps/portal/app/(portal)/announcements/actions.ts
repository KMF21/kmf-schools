"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { friendly, managerContext, text, type ActionState } from "@/lib/actions";

const AUDIENCES = ["everyone", "staff", "parents", "public"] as const;

const announcement = z.object({
  title: z.string({ error: "Give the announcement a title." }).min(3, "Give the announcement a title.").max(120, "Keep the title under 120 characters."),
  body: z.string({ error: "Write the announcement." }).min(3, "Write the announcement.").max(4000, "Keep the announcement under 4,000 characters."),
  audience: z.enum(AUDIENCES, { error: "Choose who should see it." }),
});

export async function postAnnouncement(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, viewer, supabase } = access.ctx;

  const parsed = announcement.safeParse({ title: text(form, "title"), body: text(form, "body"), audience: text(form, "audience") });
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message;
    return { error: "Check the highlighted fields.", fields };
  }

  const { error } = await supabase.from("announcements").insert({
    school_id: school.id,
    ...parsed.data,
    published_at: new Date().toISOString(),
    created_by: viewer.userId,
  });
  if (error) return friendly(error, "announcement");

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  return { ok: "Announcement posted." };
}

export async function deleteAnnouncement(_prev: ActionState, form: FormData): Promise<ActionState> {
  const access = await managerContext();
  if ("error" in access) return access.error;
  const { school, supabase } = access.ctx;

  const id = text(form, "id");
  if (!id || !z.uuid().safeParse(id).success) return { error: "That announcement couldn't be found." };

  const { error } = await supabase.from("announcements").delete().eq("id", id).eq("school_id", school.id);
  if (error) return friendly(error, "announcement");

  revalidatePath("/announcements");
  revalidatePath("/dashboard");
  return { ok: "Announcement removed." };
}
