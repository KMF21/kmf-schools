import { cache } from "react";
import {
  DEFAULT_RATINGS,
  DEFAULT_TRAITS,
  MANAGER_ROLES,
  type ComponentDef,
  type GradeBand,
  type School,
  type ScoreMap,
  type TraitKind,
} from "@kmf/core";
import { DEMO_STUDENTS } from "./demo";
import { IS_DEMO, publicAssetUrl } from "./env";
import { DEMO_STAFF, getArmOptions } from "./people";
import type { Viewer } from "./session";
import { getEditableStructure, getGrading } from "./structure";
import { supabaseForRequest } from "./supabase";

/* Everything the results screens read. Totals and positions are worked out in @kmf/core. */

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}: ${error?.message ?? "unknown error"}`);
}

/* ------------------------------------------------------------------ Terms */

export type TermOption = {
  id: string;
  number: 1 | 2 | 3;
  name: string;
  sessionId: string;
  session: string;
  label: string;
  isCurrent: boolean;
  daysOpen: number | null;
  endsOn: string | null;
  nextTermBegins: string | null;
};

const DEMO_TERM: TermOption = {
  id: "demo-term-1",
  number: 1,
  name: "First term",
  sessionId: "demo-session",
  session: "2026/2027",
  label: "First term, 2026/2027",
  isCurrent: true,
  daysOpen: 62,
  endsOn: "2026-12-11",
  nextTermBegins: "2027-01-11",
};

/** Terms that have been set up, newest first. */
export const getTerms = cache(async (school: School): Promise<TermOption[]> => {
  if (IS_DEMO) return [DEMO_TERM];
  const supabase = await supabaseForRequest();
  const { data, error } = await supabase
    .from("terms")
    .select("*, academic_sessions(name, starts_on)")
    .eq("school_id", school.id);
  if (error) fail("terms", error);
  return (data ?? [])
    .map((t) => {
      const session = t.academic_sessions as unknown as { name: string; starts_on: string | null } | null;
      return {
        id: t.id,
        number: t.term_number as 1 | 2 | 3,
        name: t.name,
        sessionId: t.session_id,
        session: session?.name ?? "",
        label: `${t.name}, ${session?.name ?? ""}`,
        isCurrent: t.is_current,
        daysOpen: t.days_open ?? null,
        endsOn: t.ends_on,
        nextTermBegins: t.next_term_begins,
      };
    })
    .sort((a, b) => b.session.localeCompare(a.session) || b.number - a.number);
});

/** The term asked for in the address, or the current term. */
export async function resolveTerm(school: School, termId?: string | null): Promise<TermOption | null> {
  const terms = await getTerms(school);
  return terms.find((t) => t.id === termId) ?? terms.find((t) => t.isCurrent) ?? terms[0] ?? null;
}

/* ------------------------------------------------------- Report settings */

export type ReportSettings = { showPosition: boolean; headTitle: string; headName: string | null; stampUrl: string | null };

const DEFAULT_REPORT_SETTINGS: ReportSettings = { showPosition: true, headTitle: "Head teacher", headName: null, stampUrl: null };

export const getReportSettings = cache(async (school: School): Promise<ReportSettings> => {
  if (IS_DEMO) return { showPosition: true, headTitle: "Principal", headName: "Dr Hauwa Bello", stampUrl: null };
  const supabase = await supabaseForRequest();
  const { data } = await supabase.from("schools").select("settings, stamp_path").eq("id", school.id).maybeSingle();
  const report = ((data?.settings as Record<string, unknown> | null)?.report ?? {}) as Partial<ReportSettings>;
  return {
    showPosition: typeof report.showPosition === "boolean" ? report.showPosition : DEFAULT_REPORT_SETTINGS.showPosition,
    headTitle: typeof report.headTitle === "string" && report.headTitle ? report.headTitle : DEFAULT_REPORT_SETTINGS.headTitle,
    headName: typeof report.headName === "string" && report.headName ? report.headName : null,
    stampUrl: publicAssetUrl(data?.stamp_path as string | null),
  };
});

export type Trait = { id: string; kind: TraitKind; name: string };

export const getTraits = cache(async (school: School): Promise<Trait[]> => {
  if (IS_DEMO) return DEFAULT_TRAITS.map((t, i) => ({ id: `demo-trait-${i + 1}`, ...t }));
  const supabase = await supabaseForRequest();
  const { data, error } = await supabase.from("report_traits").select("id, kind, name").eq("school_id", school.id).order("sort_order").order("name");
  if (error) fail("behaviour and skills", error);
  return (data ?? []).map((t) => ({ id: t.id, kind: t.kind as TraitKind, name: t.name }));
});

/* ---------------------------------------------------------------- Classes */

export type ClassStudent = { id: string; name: string; admissionNo: string; gender: "male" | "female" | null };
export type Person = { id: string; name: string };

export type ClassInfo = {
  id: string;
  label: string;
  levelId: string;
  levelName: string;
  sectionId: string;
  sectionName: string;
  style: "score" | "rating";
  subjects: Person[];
  components: ComponentDef[];
  bands: GradeBand[];
  ratingOptions: string[];
  students: ClassStudent[];
  formTeacher: Person | null;
  subjectTeachers: Record<string, Person[]>;
};

const staffName = (s: { title: string | null; first_name: string; last_name: string }) => [s.title, s.first_name, s.last_name].filter(Boolean).join(" ");

/* Demo: rosters, teachers and sample scores, generated the same way every time. */

const DEMO_FIRST = ["Aisha", "Tunde", "Grace", "Moses", "Ladi", "Kabiru", "Joy", "Nathan", "Saratu", "Elijah", "Hannah", "Bashir", "Ruth", "Gideon", "Salome", "Jibril"];
const DEMO_LAST = ["Bako", "Dauda", "Iliya", "Jatau", "Kefas", "Lawal", "Nuhu", "Sabo", "Shaibu", "Zakari", "Ayuba", "Hamman"];
const DEMO_FORM_TEACHER: Record<string, string> = { "s-jss-0-A": "demo-staff-3" };
const DEMO_SUBJECT_TEACHER: Record<string, string> = { Mathematics: "demo-staff-3", "English Studies": "demo-staff-4", "English Language": "demo-staff-4", "Basic Science": "demo-staff-7" };
/** The demo teacher (Mr Samuel Adamu) teaches maths in these classes and is form teacher of JSS 1A. */
const DEMO_TEACHER_ARMS = ["s-jss-0-A", "s-jss-0-B", "s-jss-1-A"];
/** Classes whose demo results are published (the rest show as drafts). */
const DEMO_PUBLISHED = new Set(["s-jss-0-A", "s-primary-3-A", "s-nursery-0-A"]);

/** Small deterministic hash → 0..1, so demo scores look random but never change. */
function demoNoise(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

function demoRoster(armId: string, label: string, size: number): ClassStudent[] {
  const named = DEMO_STUDENTS.filter((s) => s.className === label).map((s) => ({ id: s.id, name: s.name, admissionNo: s.admissionNo, gender: s.gender }));
  const fill = Math.max(0, Math.min(size, 24) - named.length);
  const taken = new Set(named.map((n) => n.name));
  const shift = Math.floor(demoNoise(armId) * 1000);
  const extra: ClassStudent[] = [];
  for (let i = 0; extra.length < fill && i < 200; i++) {
    // Walk through first/last name pairs so no name repeats within a class.
    const first = DEMO_FIRST[(i + shift) % DEMO_FIRST.length]!;
    const name = `${first} ${DEMO_LAST[(i + Math.floor(i / DEMO_FIRST.length) * 5 + shift) % DEMO_LAST.length]}`;
    if (taken.has(name)) continue;
    taken.add(name);
    extra.push({
      id: `demo-${armId}-${extra.length + 1}`,
      name,
      admissionNo: `BFA/2026/${String(100 + ((shift + i * 37) % 800)).padStart(3, "0")}`,
      gender: ["Aisha", "Grace", "Ladi", "Joy", "Saratu", "Hannah", "Ruth", "Salome"].includes(first) ? "female" : "male",
    });
  }
  return [...named, ...extra].sort((a, b) => a.name.localeCompare(b.name));
}

export const getClassInfo = cache(async (school: School, armId: string): Promise<ClassInfo | null> => {
  const [structure, grading, arms] = await Promise.all([getEditableStructure(school), getGrading(school), getArmOptions(school)]);
  const label = arms.find((a) => a.id === armId)?.label;
  let found: { section: (typeof structure.sections)[number]; level: (typeof structure.sections)[number]["levels"][number]; arm: { id: string; students: number } } | null = null;
  for (const section of structure.sections)
    for (const level of section.levels) for (const arm of level.arms) if (arm.id === armId) found = { section, level, arm };
  if (!found || !label) return null;

  const { section, level } = found;
  const subjectName = new Map(structure.subjects.map((s) => [s.id, s.name]));
  const subjects = level.subjectIds.flatMap((id) => (subjectName.has(id) ? [{ id, name: subjectName.get(id)! }] : []));
  const g = grading.find((x) => x.sectionId === section.id);
  const base = {
    id: armId,
    label,
    levelId: level.id,
    levelName: level.name,
    sectionId: section.id,
    sectionName: section.name,
    style: section.assessmentStyle,
    subjects,
    components: (g?.components ?? []).map((c) => ({ id: c.id, name: c.name, maxScore: c.maxScore })),
    bands: g?.scale.bands ?? [],
    ratingOptions: DEFAULT_RATINGS,
  };

  if (IS_DEMO) {
    const staff = new Map(DEMO_STAFF.map((s) => [s.id, { id: s.id, name: [s.title, s.firstName, s.lastName].filter(Boolean).join(" ") }]));
    const subjectTeachers: Record<string, Person[]> = {};
    for (const s of subjects) {
      const teacherId = DEMO_SUBJECT_TEACHER[s.name];
      if (teacherId && (teacherId !== "demo-staff-3" || DEMO_TEACHER_ARMS.includes(armId))) subjectTeachers[s.id] = [staff.get(teacherId)!];
    }
    const formTeacherId = DEMO_FORM_TEACHER[armId];
    return {
      ...base,
      students: demoRoster(armId, label, found.arm.students),
      formTeacher: formTeacherId ? staff.get(formTeacherId)! : null,
      subjectTeachers,
    };
  }

  const people = await getSchoolPeople(school);
  return {
    ...base,
    students: people.studentsByArm.get(armId) ?? [],
    formTeacher: people.formTeacherByArm.get(armId) ?? null,
    subjectTeachers: people.teachersByArm.get(armId) ?? {},
  };
});

/**
 * Students, form teachers and subject teachers for the whole school in four
 * queries, shared by every class on the page (the results list shows them all).
 */
const getSchoolPeople = cache(async (school: School) => {
  const supabase = await supabaseForRequest();
  const [students, arms, assignments, staff] = await Promise.all([
    supabase.from("students").select("id, class_arm_id, admission_no, first_name, middle_name, last_name, gender").eq("school_id", school.id).eq("status", "active").not("class_arm_id", "is", null).order("last_name").order("first_name"),
    supabase.from("class_arms").select("id, form_teacher_id").eq("school_id", school.id),
    supabase.from("teaching_assignments").select("class_arm_id, subject_id, staff_id").eq("school_id", school.id),
    supabase.from("staff").select("id, title, first_name, last_name").eq("school_id", school.id),
  ]);
  if (students.error) fail("students", students.error);
  if (arms.error) fail("classes", arms.error);
  if (assignments.error) fail("teachers", assignments.error);
  // Parents and students can't read the staff list; they don't need teacher names here.
  const names = new Map((staff.data ?? []).map((s) => [s.id as string, staffName(s)]));
  const person = (id: string | null): Person | null => (id && names.has(id) ? { id, name: names.get(id)! } : null);

  const studentsByArm = new Map<string, ClassStudent[]>();
  for (const s of students.data ?? []) {
    const list = studentsByArm.get(s.class_arm_id) ?? [];
    list.push({ id: s.id, name: [s.last_name, s.first_name, s.middle_name].filter(Boolean).join(" "), admissionNo: s.admission_no, gender: s.gender });
    studentsByArm.set(s.class_arm_id, list);
  }
  const formTeacherByArm = new Map<string, Person | null>((arms.data ?? []).map((a) => [a.id as string, person(a.form_teacher_id)]));
  const teachersByArm = new Map<string, Record<string, Person[]>>();
  for (const a of assignments.data ?? []) {
    const p = person(a.staff_id);
    if (!p) continue;
    const bySubject = teachersByArm.get(a.class_arm_id) ?? {};
    (bySubject[a.subject_id] ??= []).push(p);
    teachersByArm.set(a.class_arm_id, bySubject);
  }
  return { studentsByArm, formTeacherByArm, teachersByArm };
});

/* ----------------------------------------------------- Who can do what */

export type ClassAccess = {
  /** Manager: everything, including publishing and the head's comment. */
  manage: boolean;
  /** Form teacher: every subject, attendance, comments and ratings. */
  formTeacher: boolean;
  /** Subjects this person may enter scores for. */
  subjectIds: string[];
};

/** The signed-in person's staff record, if they have one at this school. */
export const getMyStaffId = cache(async (school: School, viewer: Viewer): Promise<string | null> => {
  if (IS_DEMO) return viewer.role === "teacher" ? "demo-staff-3" : null;
  const supabase = await supabaseForRequest();
  const { data } = await supabase.from("staff").select("id").eq("school_id", school.id).eq("user_id", viewer.userId).eq("is_active", true).maybeSingle();
  return data?.id ?? null;
});

export function accessTo(cls: ClassInfo, viewer: Viewer, staffId: string | null): ClassAccess {
  const manage = viewer.isPlatformAdmin || viewer.roles.some((r) => MANAGER_ROLES.includes(r));
  const formTeacher = Boolean(staffId && cls.formTeacher?.id === staffId);
  const subjectIds =
    manage || formTeacher ? cls.subjects.map((s) => s.id) : cls.subjects.filter((s) => (cls.subjectTeachers[s.id] ?? []).some((t) => t.id === staffId)).map((s) => s.id);
  return { manage, formTeacher, subjectIds };
}

/** Classes for the results page: all for managers; a teacher's own classes otherwise. */
export async function getResultClasses(school: School, viewer: Viewer): Promise<Array<{ id: string; label: string; sectionName: string; access: ClassAccess; subjectCount: number; students: number }>> {
  const [structure, staffId] = await Promise.all([getEditableStructure(school), getMyStaffId(school, viewer)]);
  const armIds = structure.sections.filter((s) => s.isEnabled).flatMap((s) => s.levels.flatMap((l) => l.arms.map((a) => a.id)));
  const infos = (await Promise.all(armIds.map((id) => getClassInfo(school, id)))).filter((c): c is ClassInfo => c !== null);
  return infos
    .map((c) => ({ id: c.id, label: c.label, sectionName: c.sectionName, access: accessTo(c, viewer, staffId), subjectCount: c.subjects.length, students: c.students.length }))
    .filter((c) => c.access.manage || c.access.formTeacher || c.access.subjectIds.length > 0);
}

/* --------------------------------------------------------------- Results */

export type TermReport = { daysPresent: number | null; teacherComment: string | null; headComment: string | null; traits: Record<string, number> };
export type Release = { publishedAt: string } | null;

export type ClassTermData = {
  scores: Record<string, Record<string, ScoreMap>>;
  ratings: Record<string, Record<string, string>>;
  reports: Record<string, TermReport>;
  release: Release;
};

function demoClassData(cls: ClassInfo, term: TermOption): ClassTermData {
  const scores: ClassTermData["scores"] = {};
  const ratings: ClassTermData["ratings"] = {};
  const reports: ClassTermData["reports"] = {};
  const comments = ["A hardworking and well-behaved student.", "Shows good progress. Keep it up.", "Can do better with more focus in class.", "A brilliant term. Well done."];
  for (const st of cls.students) {
    const ability = 0.35 + demoNoise(st.id) * 0.6; // each student has a steady level
    for (const sub of cls.subjects) {
      if (cls.style === "rating") {
        const pick = Math.min(4, Math.floor((1 - ability) * 4 + demoNoise(st.id + sub.id) * 1.5));
        (ratings[st.id] ??= {})[sub.id] = cls.ratingOptions[pick]!;
        continue;
      }
      // JSS 1B maths is only partly entered, to show progress tracking.
      const partial = cls.id === "s-jss-0-B" && sub.name === "Mathematics";
      for (const c of cls.components) {
        if (partial && c.name === "Exam") continue;
        const v = Math.min(c.maxScore, Math.max(0, Math.round(c.maxScore * (ability + (demoNoise(st.id + sub.id + c.id) - 0.5) * 0.3))));
        ((scores[st.id] ??= {})[sub.id] ??= {})[c.id] = v;
      }
    }
    reports[st.id] = {
      daysPresent: Math.max(40, (term.daysOpen ?? 62) - Math.floor(demoNoise(`att-${st.id}`) * 8)),
      teacherComment: comments[Math.floor(demoNoise(`c-${st.id}`) * comments.length)]!,
      headComment: DEMO_PUBLISHED.has(cls.id) ? "Promising. Keep working hard." : null,
      traits: Object.fromEntries(DEFAULT_TRAITS.map((_, i) => [`demo-trait-${i + 1}`, 3 + Math.round(demoNoise(`t-${st.id}-${i}`) * 2)])),
    };
  }
  return { scores, ratings, reports, release: DEMO_PUBLISHED.has(cls.id) ? { publishedAt: "2026-12-12T10:00:00Z" } : null };
}

export const getClassTermData = cache(async (school: School, cls: ClassInfo, term: TermOption): Promise<ClassTermData> => {
  if (IS_DEMO) return demoClassData(cls, term);
  const supabase = await supabaseForRequest();
  const [scores, ratings, reports, release] = await Promise.all([
    supabase.from("scores").select("student_id, subject_id, component_id, score").eq("school_id", school.id).eq("term_id", term.id).eq("class_arm_id", cls.id),
    supabase.from("ratings").select("student_id, subject_id, rating").eq("school_id", school.id).eq("term_id", term.id).eq("class_arm_id", cls.id),
    supabase.from("term_reports").select("student_id, days_present, teacher_comment, head_comment, traits").eq("school_id", school.id).eq("term_id", term.id).eq("class_arm_id", cls.id),
    supabase.from("result_releases").select("published_at").eq("school_id", school.id).eq("term_id", term.id).eq("class_arm_id", cls.id).maybeSingle(),
  ]);
  for (const [what, r] of [["scores", scores], ["ratings", ratings], ["reports", reports], ["publishing status", release]] as const) if (r.error) fail(what, r.error);

  const data: ClassTermData = { scores: {}, ratings: {}, reports: {}, release: release.data ? { publishedAt: release.data.published_at } : null };
  for (const s of scores.data ?? []) ((data.scores[s.student_id] ??= {})[s.subject_id] ??= {})[s.component_id] = Number(s.score);
  for (const r of ratings.data ?? []) (data.ratings[r.student_id] ??= {})[r.subject_id] = r.rating;
  for (const r of reports.data ?? [])
    data.reports[r.student_id] = { daysPresent: r.days_present, teacherComment: r.teacher_comment, headComment: r.head_comment, traits: (r.traits ?? {}) as Record<string, number> };
  return data;
});

/**
 * Subject totals from earlier terms of the same session, for third-term report
 * cards: studentId → subjectId → [first, second] totals.
 */
export async function getEarlierTermTotals(school: School, cls: ClassInfo, term: TermOption): Promise<{ terms: TermOption[]; totals: Record<string, Record<string, Array<number | null>>> }> {
  if (term.number === 1) return { terms: [], totals: {} };
  const earlier = (await getTerms(school)).filter((t) => t.sessionId === term.sessionId && t.number < term.number).sort((a, b) => a.number - b.number);
  if (IS_DEMO || earlier.length === 0) return { terms: earlier, totals: {} };

  const supabase = await supabaseForRequest();
  const ids = cls.students.map((s) => s.id);
  const { data, error } = await supabase
    .from("scores")
    .select("term_id, student_id, subject_id, score")
    .eq("school_id", school.id)
    .in("term_id", earlier.map((t) => t.id))
    .in("student_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  if (error) fail("earlier terms", error);
  const totals: Record<string, Record<string, Array<number | null>>> = {};
  for (const r of data ?? []) {
    const idx = earlier.findIndex((t) => t.id === r.term_id);
    const row = ((totals[r.student_id] ??= {})[r.subject_id] ??= earlier.map(() => null));
    row[idx] = Math.round(((row[idx] ?? 0) + Number(r.score)) * 100) / 100;
  }
  return { terms: earlier, totals };
}

/* ------------------------------------------------ Parents and students */

export type ChildResult = { studentId: string; name: string; armId: string; armLabel: string; termId: string; termLabel: string; publishedAt: string };

/** Published report cards the signed-in parent or student may open. */
export async function getMyPublishedResults(school: School, viewer: Viewer): Promise<ChildResult[]> {
  if (IS_DEMO) {
    if (viewer.role !== "parent" && viewer.role !== "student") return [];
    const child = DEMO_STUDENTS[0]!;
    return [{ studentId: child.id, name: child.name, armId: "s-jss-0-A", armLabel: "JSS 1A", termId: DEMO_TERM.id, termLabel: DEMO_TERM.label, publishedAt: "2026-12-12T10:00:00Z" }];
  }
  const supabase = await supabaseForRequest();
  // Row level security returns only this person's own (or their children's) published rows.
  const [{ data: reports }, terms, arms] = await Promise.all([
    supabase.from("term_reports").select("student_id, term_id, class_arm_id, students(first_name, last_name)").eq("school_id", school.id),
    getTerms(school),
    getArmOptions(school),
  ]);
  const { data: scored } = await supabase.from("result_releases").select("term_id, class_arm_id, published_at").eq("school_id", school.id);
  const released = new Map((scored ?? []).map((r) => [`${r.term_id}:${r.class_arm_id}`, r.published_at as string]));
  const out: ChildResult[] = [];
  for (const r of reports ?? []) {
    const publishedAt = released.get(`${r.term_id}:${r.class_arm_id}`);
    const term = terms.find((t) => t.id === r.term_id);
    if (!publishedAt || !term) continue;
    const st = r.students as unknown as { first_name: string; last_name: string } | null;
    out.push({
      studentId: r.student_id,
      name: st ? `${st.first_name} ${st.last_name}` : "Student",
      armId: r.class_arm_id,
      armLabel: arms.find((a) => a.id === r.class_arm_id)?.label ?? "",
      termId: term.id,
      termLabel: term.label,
      publishedAt,
    });
  }
  return out.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/** Classes whose results are published for a term. */
export const getReleasedArms = cache(async (school: School, termId: string): Promise<Set<string>> => {
  if (IS_DEMO) return new Set(DEMO_PUBLISHED);
  const supabase = await supabaseForRequest();
  const { data, error } = await supabase.from("result_releases").select("class_arm_id").eq("school_id", school.id).eq("term_id", termId);
  if (error) fail("publishing status", error);
  return new Set((data ?? []).map((r) => r.class_arm_id as string));
});
