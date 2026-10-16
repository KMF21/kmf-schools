/** Roles a person can hold within one school. A person may hold different roles in different schools. */
export const ROLES = ["owner", "admin", "teacher", "bursar", "parent", "student"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Proprietor",
  admin: "School admin",
  teacher: "Teacher",
  bursar: "Bursar",
  parent: "Parent",
  student: "Student",
};

/** Staff roles can see school-wide records; parents and students see only their own. */
export const STAFF_ROLES: readonly Role[] = ["owner", "admin", "teacher", "bursar"];
export const MANAGER_ROLES: readonly Role[] = ["owner", "admin"];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export type Capability =
  | "school.settings"
  | "people.manage"
  | "results.enter"
  | "results.publish"
  | "fees.manage"
  | "results.view_own";

const CAPABILITIES: Record<Role, readonly Capability[]> = {
  owner: ["school.settings", "people.manage", "results.enter", "results.publish", "fees.manage"],
  admin: ["school.settings", "people.manage", "results.enter", "results.publish", "fees.manage"],
  teacher: ["results.enter"],
  bursar: ["fees.manage"],
  parent: ["results.view_own"],
  student: ["results.view_own"],
};

export function can(role: Role, capability: Capability): boolean {
  return CAPABILITIES[role].includes(capability);
}
