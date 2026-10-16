/**
 * Login identifiers.
 *
 * Supabase Auth needs an email for every account, but most students and many
 * parents don't have one. So:
 *  - students sign in with their admission number,
 *  - parents sign in with their phone number,
 *  - staff sign in with their email, or their phone number if they have none.
 *
 * Admission numbers and phone numbers map to private, school-scoped addresses
 * that are never shown to anyone or emailed. A teacher who is also a parent at
 * the same school uses one phone-number account holding both roles.
 */

const INTERNAL_DOMAIN = "accounts.kmfschools.ng";

/** "KMF/2024/017 " -> "kmf-2024-017" */
export function normalizeAdmissionNo(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Nigerian numbers to one form: "+234 803 123 4567", "2348031234567" and "08031234567" -> "08031234567". */
export function normalizePhone(value: string): string | null {
  let digits = value.replace(/[^\d+]/g, "");
  if (digits.startsWith("+234")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("234") && digits.length === 13) digits = `0${digits.slice(3)}`;
  digits = digits.replace(/\+/g, "");
  if (/^[789]\d{9}$/.test(digits)) digits = `0${digits}`;
  return /^\d{7,15}$/.test(digits) ? digits : null;
}

/** True when what someone typed looks like a phone number rather than an admission number. */
export function looksLikePhone(value: string): boolean {
  const v = value.trim();
  if (!/^[+\d][\d\s-]*$/.test(v)) return false;
  const p = normalizePhone(v);
  return p !== null && /^0[789]\d{9}$/.test(p);
}

export function studentLoginEmail(admissionNo: string, schoolId: string): string {
  const id = normalizeAdmissionNo(admissionNo);
  if (!id) throw new Error("Enter an admission number.");
  return `s-${id}@${schoolId.toLowerCase()}.${INTERNAL_DOMAIN}`;
}

export function phoneLoginEmail(phone: string, schoolId: string): string {
  const p = normalizePhone(phone);
  if (!p) throw new Error("Enter a valid phone number.");
  return `p-${p}@${schoolId.toLowerCase()}.${INTERNAL_DOMAIN}`;
}

/** @deprecated kept for older callers; use studentLoginEmail. */
export const internalLoginEmail = studentLoginEmail;

export function isInternalLoginEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`.${INTERNAL_DOMAIN}`);
}

/** What a person types on their login slip, from an internal address. */
export function displayLogin(email: string): string {
  if (!isInternalLoginEmail(email)) return email;
  const local = email.split("@")[0] ?? "";
  return local.slice(2);
}

/**
 * The account addresses to try, in order, for what someone typed in the login box.
 * An email is used as is. Otherwise it's an admission number, and if it also
 * looks like a phone number, a parent's or staff member's phone login is tried too.
 */
export function loginCandidates(input: string, schoolId: string): string[] {
  const value = input.trim();
  if (value.includes("@")) return [value.toLowerCase()];
  const out: string[] = [];
  if (normalizeAdmissionNo(value)) out.push(studentLoginEmail(value, schoolId));
  if (looksLikePhone(value)) out.push(phoneLoginEmail(value, schoolId));
  return out;
}

/** @deprecated use loginCandidates. */
export function resolveLoginIdentifier(input: string, schoolId: string): { email: string; kind: "email" | "admission" } {
  const value = input.trim();
  if (value.includes("@")) return { email: value.toLowerCase(), kind: "email" };
  return { email: studentLoginEmail(value, schoolId), kind: "admission" };
}

/** Readable one-time passwords: no 0/O, 1/l/I, so they survive being copied from paper. */
export function generatePassword(length = 8, random: (n: number) => number = secureRandomInt): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[random(alphabet.length)];
  return out;
}

function secureRandomInt(n: number): number {
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x100000000 / n) * n;
  do crypto.getRandomValues(buf);
  while (buf[0]! >= limit);
  return buf[0]! % n;
}
