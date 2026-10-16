/**
 * Login identifiers.
 *
 * Staff sign in with their email address. Students and parents usually have no
 * email, so they sign in with an admission number (or a parent ID). Supabase
 * Auth needs an email for every account, so each admission number maps to a
 * private, school-scoped address that is never shown to anyone or emailed.
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

export function internalLoginEmail(admissionNo: string, schoolId: string): string {
  const id = normalizeAdmissionNo(admissionNo);
  if (!id) throw new Error("Enter an admission number.");
  return `${id}@${schoolId.toLowerCase()}.${INTERNAL_DOMAIN}`;
}

export function isInternalLoginEmail(email: string): boolean {
  return email.toLowerCase().endsWith(`.${INTERNAL_DOMAIN}`);
}

/** Decides whether what the person typed is an email or an admission number. */
export function resolveLoginIdentifier(input: string, schoolId: string): { email: string; kind: "email" | "admission" } {
  const value = input.trim();
  if (value.includes("@")) return { email: value.toLowerCase(), kind: "email" };
  return { email: internalLoginEmail(value, schoolId), kind: "admission" };
}
