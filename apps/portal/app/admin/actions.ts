"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generatePassword, isValidSlug, normalizeHostname, normalizePhone, phoneLoginEmail, displayLogin } from "@kmf/core";
import { DEMO_READ_ONLY, friendly, text, type ActionState } from "@/lib/actions";
import { ADMIN_MISSING_MESSAGE, adminClient } from "@/lib/admin";
import { addMembership, ensureAccount } from "@/lib/accounts";
import { IS_DEMO, ROOT_DOMAIN } from "@/lib/env";
import { DEMO_ADMIN_COOKIE, getPlatformAdmin, onPlatformAddress } from "@/lib/platform";
import { supabaseForRequest } from "@/lib/supabase";
import { forgetSchool } from "@/lib/tenant";

export type CreatedLogin = { name: string; login: string; password: string | null };
export type AdminState = ActionState & { login?: CreatedLogin; schoolId?: string };

type PlatformCtx = { supabase: Awaited<ReturnType<typeof supabaseForRequest>> } | { error: ActionState };

async function platformContext(): Promise<PlatformCtx> {
  if (IS_DEMO) return { error: DEMO_READ_ONLY };
  if (!(await onPlatformAddress())) return { error: { error: "Open the KMF admin area on the KMF Schools address." } };
  const me = await getPlatformAdmin();
  if (!me) return { error: { error: "Your session has ended. Sign in again, then retry." } };
  return { supabase: await supabaseForRequest() };
}

/* ------------------------------------------------------------- Signing in */

export type SignInState = { error?: string; email?: string };

export async function signInAdmin(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!z.email().safeParse(email).success) return { error: "Enter your KMF email address.", email };
  if (!password) return { error: "Enter your password.", email };

  const supabase = await supabaseForRequest();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { email, error: error?.status === 429 ? "Too many sign-in attempts. Wait a few minutes, then try again." : "That email and password don't match." };
  }
  const { data: platform } = await supabase.from("platform_admins").select("user_id").eq("user_id", data.user.id).maybeSingle();
  if (!platform) {
    await supabase.auth.signOut();
    return { email, error: "This account isn't a KMF admin. School staff sign in on their school's portal." };
  }
  redirect("/admin");
}

export async function signInAdminDemo(): Promise<void> {
  if (!IS_DEMO) redirect("/admin/login");
  (await cookies()).set(DEMO_ADMIN_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 });
  redirect("/admin");
}

export async function signOutAdmin(): Promise<void> {
  if (IS_DEMO) (await cookies()).delete(DEMO_ADMIN_COOKIE);
  else await (await supabaseForRequest()).auth.signOut();
  redirect("/admin/login");
}

/* -------------------------------------------------------------- Schools */

const HEX = /^#[0-9a-f]{6}$/i;

/** Makes a first login for the proprietor or an admin. Email preferred; phone works too. */
async function grantManager(schoolId: string, name: string, contact: string, role: "owner" | "admin"): Promise<{ login?: CreatedLogin; error?: string }> {
  const admin = adminClient();
  if (!admin) return { error: ADMIN_MISSING_MESSAGE };
  const isEmail = contact.includes("@");
  if (isEmail && !z.email().safeParse(contact).success) return { error: "That email address doesn't look right." };
  const phone = isEmail ? null : normalizePhone(contact);
  if (!isEmail && !phone) return { error: "Enter an email address or a Nigerian phone number." };
  const email = isEmail ? contact.toLowerCase() : phoneLoginEmail(phone!, schoolId);

  const password = generatePassword();
  try {
    const account = await ensureAccount(admin, email, password, { school_id: schoolId, display_name: name });
    await addMembership(admin, schoolId, account.userId, role, name);
    return { login: { name, login: displayLogin(email), password: account.created ? password : null } };
  } catch (e) {
    console.error("[kmf] grant manager:", e instanceof Error ? e.message : e);
    return { error: "The login couldn't be created. Check your connection and try again." };
  }
}

export async function createSchool(_prev: AdminState, form: FormData): Promise<AdminState> {
  const ctx = await platformContext();
  if ("error" in ctx) return ctx.error;

  const name = text(form, "name");
  const slug = (text(form, "slug") ?? "").toLowerCase();
  const color = text(form, "brand_color") ?? "#1a8754";
  const ownerName = text(form, "owner_name");
  const ownerContact = text(form, "owner_contact");

  const fields: Record<string, string> = {};
  if (!name || name.length > 120) fields.name = "Enter the school's full name.";
  if (!isValidSlug(slug)) fields.slug = "Use lowercase letters, numbers and dashes, like brightfield-academy.";
  if (!HEX.test(color)) fields.brand_color = "Choose a colour.";
  if (ownerContact && !ownerName) fields.owner_name = "Enter the proprietor's name.";
  if (Object.keys(fields).length) return { error: "Check the highlighted fields.", fields };

  const { data, error } = await ctx.supabase
    .from("schools")
    .insert({ name, slug, short_name: text(form, "short_name"), brand_color: color.toLowerCase(), phone: text(form, "phone"), email: text(form, "email"), status: "setup" })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return { error: "Another school already uses that web name.", fields: { slug: "Already taken. Try adding the town, like brightfield-jalingo." } };
    return friendly(error, "school");
  }

  revalidatePath("/admin");
  if (!ownerName || !ownerContact) return { ok: `${name} is set up.`, schoolId: data.id };

  const granted = await grantManager(data.id, ownerName, ownerContact, "owner");
  if (granted.error) return { ok: `${name} is set up, but the proprietor's login wasn't: ${granted.error}`, schoolId: data.id };
  return { ok: `${name} is set up, with a login for the proprietor.`, schoolId: data.id, login: granted.login };
}

export async function addManager(_prev: AdminState, form: FormData): Promise<AdminState> {
  const ctx = await platformContext();
  if ("error" in ctx) return ctx.error;
  const schoolId = z.uuid().safeParse(form.get("school_id"));
  const role = z.enum(["owner", "admin"]).safeParse(form.get("role"));
  const name = text(form, "name");
  const contact = text(form, "contact");
  if (!schoolId.success || !role.success) return { error: "Choose a role." };
  if (!name) return { error: "Enter their name.", fields: { name: "Enter their name." } };
  if (!contact) return { error: "Enter an email address or phone number.", fields: { contact: "Required." } };

  const granted = await grantManager(schoolId.data, name, contact, role.data);
  if (granted.error) return { error: granted.error };
  revalidatePath(`/admin/schools/${schoolId.data}`);
  return { ok: `${name} can now sign in as ${role.data === "owner" ? "proprietor" : "school admin"}.`, login: granted.login };
}

export async function setSchoolStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await platformContext();
  if ("error" in ctx) return ctx.error;
  const schoolId = z.uuid().safeParse(form.get("school_id"));
  const status = z.enum(["setup", "active", "suspended"]).safeParse(form.get("status"));
  if (!schoolId.success || !status.success) return { error: "Choose a status." };

  const { error } = await ctx.supabase.from("schools").update({ status: status.data }).eq("id", schoolId.data);
  if (error) return friendly(error, "school");
  forgetSchool(schoolId.data);
  revalidatePath("/admin");
  revalidatePath(`/admin/schools/${schoolId.data}`);
  const said = { setup: "Marked as being set up.", active: "The school is live.", suspended: "The school is suspended. Its portal is closed until you make it live again." };
  return { ok: said[status.data] };
}

/* -------------------------------------------------------------- Domains */

const HOST_RE = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export async function addDomain(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await platformContext();
  if ("error" in ctx) return ctx.error;
  const schoolId = z.uuid().safeParse(form.get("school_id"));
  const kind = z.enum(["portal", "website"]).safeParse(form.get("kind"));
  if (!schoolId.success || !kind.success) return { error: "Choose what the address is for." };

  const raw = String(form.get("hostname") ?? "").trim().replace(/^https?:\/\//i, "").split("/")[0] ?? "";
  const hostname = normalizeHostname(raw);
  if (!HOST_RE.test(hostname)) return { error: "Enter an address like portal.brightfield.com.ng.", fields: { hostname: "Not a valid address." } };
  if (hostname === ROOT_DOMAIN || hostname.endsWith(`.${ROOT_DOMAIN}`)) {
    return { error: `Addresses ending in ${ROOT_DOMAIN} work on their own. Only add the school's own domain.`, fields: { hostname: "Not needed." } };
  }

  const { error } = await ctx.supabase.from("school_domains").insert({ hostname, school_id: schoolId.data, kind: kind.data });
  if (error) {
    if (error.code === "23505") return { error: "That address is already connected to a school.", fields: { hostname: "Already in use." } };
    return friendly(error, "address");
  }
  revalidatePath(`/admin/schools/${schoolId.data}`);
  return { ok: `${hostname} added. Now add it in Vercel and set the school's DNS as shown below.` };
}

export async function removeDomain(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await platformContext();
  if ("error" in ctx) return ctx.error;
  const schoolId = z.uuid().safeParse(form.get("school_id"));
  const hostname = normalizeHostname(String(form.get("hostname") ?? ""));
  if (!schoolId.success || !hostname) return { error: "That address couldn't be found." };
  const { error } = await ctx.supabase.from("school_domains").delete().eq("hostname", hostname).eq("school_id", schoolId.data);
  if (error) return friendly(error, "address");
  forgetSchool(schoolId.data);
  revalidatePath(`/admin/schools/${schoolId.data}`);
  return { ok: `${hostname} removed.` };
}

export async function markDomainWorking(_prev: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await platformContext();
  if ("error" in ctx) return ctx.error;
  const schoolId = z.uuid().safeParse(form.get("school_id"));
  const hostname = normalizeHostname(String(form.get("hostname") ?? ""));
  if (!schoolId.success || !hostname) return { error: "That address couldn't be found." };
  const { error } = await ctx.supabase.from("school_domains").update({ verified_at: new Date().toISOString() }).eq("hostname", hostname).eq("school_id", schoolId.data);
  if (error) return friendly(error, "address");
  revalidatePath(`/admin/schools/${schoolId.data}`);
  return { ok: `${hostname} marked as working.` };
}
