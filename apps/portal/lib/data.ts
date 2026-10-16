import { cache } from "react";
import type { Role, School, SetupStep } from "@kmf/core";
import { IS_DEMO } from "./env";
import { DEMO_SCHOOL, DEMO_STAFF_COUNT, DEMO_STRUCTURE, DEMO_STUDENTS } from "./demo";
import { supabaseForRequest } from "./supabase";

/* ------------------------------------------------------------------ Types */

export type CurrentTerm = {
  number: number;
  name: string;
  session: string;
  startsOn: string | null;
  endsOn: string | null;
  nextTermBegins: string | null;
} | null;

export type Announcement = { id: string; title: string; body: string; audience: string; publishedAt: string | null };

export type StructureLevel = { id: string; name: string; arms: Array<{ id: string; name: string; students: number }>; subjects: string[] };
export type StructureSection = { id: string; name: string; kind: string; assessmentStyle: "score" | "rating"; levels: StructureLevel[] };

export type StudentRow = { id: string; name: string; admissionNo: string; className: string; gender: string | null; status: string };

export type Overview = {
  term: CurrentTerm;
  counts: { students: number; staff: number; classes: number; subjects: number };
  setup: SetupStep[];
};

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}: ${error?.message ?? "unknown error"}`);
}

/* --------------------------------------------------------------- Demo data */

const DEMO_ANNOUNCEMENTS: Announcement[] = [
  { id: "a1", title: "First term mid-term break", body: "School closes Thursday 29 October and resumes Monday 2 November.", audience: "everyone", publishedAt: "2026-10-12T08:00:00Z" },
  { id: "a2", title: "Inter-house sports", body: "Parents are welcome to the inter-house sports on Saturday 21 November at 9am.", audience: "public", publishedAt: "2026-10-08T08:00:00Z" },
  { id: "a3", title: "CA 1 scores due", body: "Teachers, please complete CA 1 entries for all your classes by Friday 23 October.", audience: "staff", publishedAt: "2026-10-05T08:00:00Z" },
];

function demoStructure(): StructureSection[] {
  return DEMO_STRUCTURE.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    assessmentStyle: s.assessmentStyle,
    levels: s.levels.map((l, li) => ({
      id: `${s.id}-${li}`,
      name: l.name,
      subjects: l.subjects,
      arms: l.arms.map((a) => ({ id: `${s.id}-${li}-${a.name}`, name: a.name, students: a.students })),
    })),
  }));
}

/* ----------------------------------------------------------------- Queries */

export const getCurrentTerm = cache(async (school: School): Promise<CurrentTerm> => {
  if (IS_DEMO) {
    return { number: 1, name: "First term", session: "2026/2027", startsOn: "2026-09-14", endsOn: "2026-12-11", nextTermBegins: "2027-01-11" };
  }
  const supabase = await supabaseForRequest();
  const { data, error } = await supabase
    .from("terms")
    .select("term_number, name, starts_on, ends_on, next_term_begins, academic_sessions(name)")
    .eq("school_id", school.id)
    .eq("is_current", true)
    .maybeSingle();
  if (error) fail("the current term", error);
  if (!data) return null;
  const session = data.academic_sessions as unknown as { name: string } | null;
  return {
    number: data.term_number,
    name: data.name,
    session: session?.name ?? "",
    startsOn: data.starts_on,
    endsOn: data.ends_on,
    nextTermBegins: data.next_term_begins,
  };
});

export const getStructure = cache(async (school: School): Promise<StructureSection[]> => {
  if (IS_DEMO) return demoStructure();

  const supabase = await supabaseForRequest();
  const [sections, levels, arms, classSubjects, subjects, students] = await Promise.all([
    supabase.from("sections").select("id, name, kind, assessment_style, sort_order").eq("school_id", school.id).eq("is_enabled", true).order("sort_order"),
    supabase.from("class_levels").select("id, section_id, name, sort_order").eq("school_id", school.id).order("sort_order"),
    supabase.from("class_arms").select("id, class_level_id, name").eq("school_id", school.id).order("name"),
    supabase.from("class_subjects").select("class_level_id, subject_id, sort_order").eq("school_id", school.id),
    supabase.from("subjects").select("id, name").eq("school_id", school.id),
    supabase.from("students").select("class_arm_id").eq("school_id", school.id).eq("status", "active"),
  ]);
  for (const [what, r] of [["sections", sections], ["classes", levels], ["class arms", arms], ["class subjects", classSubjects], ["subjects", subjects], ["students", students]] as const) {
    if (r.error) fail(what, r.error);
  }

  const subjectName = new Map((subjects.data ?? []).map((s) => [s.id, s.name]));
  const perArm = new Map<string, number>();
  for (const s of students.data ?? []) if (s.class_arm_id) perArm.set(s.class_arm_id, (perArm.get(s.class_arm_id) ?? 0) + 1);

  return (sections.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    assessmentStyle: s.assessment_style as "score" | "rating",
    levels: (levels.data ?? [])
      .filter((l) => l.section_id === s.id)
      .map((l) => ({
        id: l.id,
        name: l.name,
        arms: (arms.data ?? []).filter((a) => a.class_level_id === l.id).map((a) => ({ id: a.id, name: a.name, students: perArm.get(a.id) ?? 0 })),
        subjects: (classSubjects.data ?? [])
          .filter((cs) => cs.class_level_id === l.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((cs) => subjectName.get(cs.subject_id) ?? "")
          .filter(Boolean),
      })),
  }));
});

export const getOverview = cache(async (school: School): Promise<Overview> => {
  const term = await getCurrentTerm(school);

  if (IS_DEMO) {
    const structure = demoStructure();
    const classes = structure.reduce((n, s) => n + s.levels.reduce((m, l) => m + l.arms.length, 0), 0);
    const students = structure.reduce((n, s) => n + s.levels.reduce((m, l) => m + l.arms.reduce((k, a) => k + a.students, 0), 0), 0);
    const subjects = new Set(structure.flatMap((s) => s.levels.flatMap((l) => l.subjects))).size;
    return {
      term,
      counts: { students, staff: DEMO_STAFF_COUNT, classes, subjects },
      setup: buildSetup({ profile: Boolean(DEMO_SCHOOL.address && DEMO_SCHOOL.phone), structure: true, grading: true, students: true, staff: true, firstResult: false }),
    };
  }

  const supabase = await supabaseForRequest();
  const counted = (table: string) => supabase.from(table).select("*", { count: "exact", head: true }).eq("school_id", school.id);
  const [students, staff, arms, subjects, scales, scoreSections] = await Promise.all([
    counted("students").eq("status", "active"),
    counted("staff").eq("is_active", true),
    counted("class_arms"),
    counted("subjects").eq("is_active", true),
    counted("grading_scales"),
    counted("sections").eq("is_enabled", true).eq("assessment_style", "score"),
  ]);
  for (const r of [students, staff, arms, subjects, scales, scoreSections]) if (r.error) fail("the school overview", r.error);

  return {
    term,
    counts: { students: students.count ?? 0, staff: staff.count ?? 0, classes: arms.count ?? 0, subjects: subjects.count ?? 0 },
    setup: buildSetup({
      profile: Boolean(school.address && school.phone && school.logoUrl),
      structure: (arms.count ?? 0) > 0 && (subjects.count ?? 0) > 0,
      grading: (scoreSections.count ?? 0) > 0 && (scales.count ?? 0) >= (scoreSections.count ?? 0),
      students: (students.count ?? 0) > 0,
      staff: (staff.count ?? 0) > 0,
      firstResult: false,
    }),
  };
});

function buildSetup(done: Record<"profile" | "structure" | "grading" | "students" | "staff" | "firstResult", boolean>): SetupStep[] {
  return [
    { key: "profile", title: "Add your school's details", description: "Logo, address, phone number and brand colour.", done: done.profile },
    { key: "structure", title: "Set up classes and subjects", description: "Choose your sections, then confirm the classes and subjects each one offers.", done: done.structure },
    { key: "grading", title: "Confirm grading", description: "Grading scales and CA/exam weighting for each section.", done: done.grading },
    { key: "students", title: "Import students", description: "Upload your student list from Excel or add students one by one.", done: done.students },
    { key: "staff", title: "Invite staff", description: "Add teachers and assign their classes and subjects.", done: done.staff },
    { key: "first_result", title: "Publish your first results", description: "Enter scores, review the broadsheet, then publish to parents.", done: done.firstResult },
  ];
}

/** Mirrors the announcements_read rule in the database, for demo mode. */
function visibleTo(audience: string, roles: readonly Role[]): boolean {
  const has = (...r: Role[]) => roles.some((x) => r.includes(x));
  if (has("owner", "admin")) return true;
  if (audience === "everyone" || audience === "public") return true;
  if (audience === "staff") return has("teacher", "bursar");
  if (audience === "parents") return has("parent");
  return false;
}

/** In live mode the database filters by audience; `roles` is only used for demo data. */
export const getAnnouncements = cache(async (school: School, roles: readonly Role[], limit = 20): Promise<Announcement[]> => {
  if (IS_DEMO) return DEMO_ANNOUNCEMENTS.filter((a) => visibleTo(a.audience, roles)).slice(0, limit);
  const supabase = await supabaseForRequest();
  const { data, error } = await supabase
    .from("announcements")
    .select("id, title, body, audience, published_at")
    .eq("school_id", school.id)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) fail("announcements", error);
  return (data ?? []).map((a) => ({ id: a.id, title: a.title, body: a.body, audience: a.audience, publishedAt: a.published_at }));
});

export async function getStudents(school: School, search?: string): Promise<StudentRow[]> {
  const term = search?.trim().toLowerCase() ?? "";
  if (IS_DEMO) {
    return DEMO_STUDENTS.filter((s) => !term || s.name.toLowerCase().includes(term) || s.admissionNo.toLowerCase().includes(term));
  }

  const supabase = await supabaseForRequest();
  let query = supabase
    .from("students")
    .select("id, first_name, middle_name, last_name, admission_no, gender, status, class_arm_id")
    .eq("school_id", school.id)
    .order("last_name")
    .limit(500);
  if (term) {
    const safe = term.replace(/[%,()]/g, " ");
    query = query.or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,admission_no.ilike.%${safe}%`);
  }
  const { data, error } = await query;
  if (error) fail("students", error);

  const structure = await getStructure(school);
  const armName = new Map<string, string>();
  for (const s of structure) for (const l of s.levels) for (const a of l.arms) armName.set(a.id, l.arms.length > 1 ? `${l.name}${a.name}` : l.name);

  return (data ?? []).map((s) => ({
    id: s.id,
    name: [s.first_name, s.middle_name, s.last_name].filter(Boolean).join(" "),
    admissionNo: s.admission_no,
    className: (s.class_arm_id && armName.get(s.class_arm_id)) || "Not in a class",
    gender: s.gender,
    status: s.status,
  }));
}
