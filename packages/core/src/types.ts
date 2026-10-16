import type { Role } from "./roles";
import type { AssessmentStyle, SectionKind } from "./curriculum";

/** The public face of a school: everything needed to brand its pages. */
export type School = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  motto: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logoUrl: string | null;
  brandColor: string;
  status: "active" | "suspended" | "setup";
};

export type Section = {
  id: string;
  kind: SectionKind;
  name: string;
  assessmentStyle: AssessmentStyle;
  isEnabled: boolean;
};

export type Membership = {
  schoolId: string;
  role: Role;
  displayName: string;
};

export type SetupStep = {
  key: "profile" | "structure" | "grading" | "students" | "staff" | "first_result";
  title: string;
  description: string;
  done: boolean;
};
