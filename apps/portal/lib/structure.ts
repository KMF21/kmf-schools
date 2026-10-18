import { cache } from "react";
import { BASIC_SCALE, DEFAULT_COMPONENTS, WAEC_SCALE, type GradeBand, type School, type SectionKind } from "@kmf/core";
import { IS_DEMO } from "./env";
import { DEMO_STRUCTURE } from "./demo";
import { fetchAll, supabaseForRequest } from "./supabase";

/* Data for the screens where managers set up classes, subjects and grading. */

export type EditableArm = { id: string; name: string; students: number };
export type EditableLevel = { id: string; name: string; arms: EditableArm[]; subjectIds: string[] };
export type EditableSection = {
  id: string;
  kind: SectionKind;
  name: string;
  assessmentStyle: "score" | "rating";
  isEnabled: boolean;
  levels: EditableLevel[];
};
export type SubjectOption = { id: string; name: string };
export type SchoolStructure = { sections: EditableSection[]; subjects: SubjectOption[] };

export type Component = { id: string; name: string; maxScore: number };
export type SectionGrading = {
  sectionId: string;
  sectionName: string;
  kind: SectionKind;
  components: Component[];
  scale: { id: string | null; name: string; bands: GradeBand[] };
};

function fail(what: string, error: { message: string } | null): never {
  throw new Error(`Could not load ${what}: ${error?.message ?? "unknown error"}`);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function demoStructure(): SchoolStructure {
  const subjectNames = [...new Set(DEMO_STRUCTURE.flatMap((s) => s.levels.flatMap((l) => l.subjects)))].sort();
  return {
    subjects: subjectNames.map((name) => ({ id: `subj-${slug(name)}`, name })),
    sections: DEMO_STRUCTURE.map((s) => ({
      id: s.id,
      kind: s.kind as SectionKind,
      name: s.name,
      assessmentStyle: s.assessmentStyle,
      isEnabled: true,
      levels: s.levels.map((l, i) => ({
        id: `${s.id}-${i}`,
        name: l.name,
        arms: l.arms.map((a) => ({ id: `${s.id}-${i}-${a.name}`, name: a.name, students: a.students })),
        subjectIds: l.subjects.map((name) => `subj-${slug(name)}`),
      })),
    })),
  };
}

export const getEditableStructure = cache(async (school: School): Promise<SchoolStructure> => {
  if (IS_DEMO) return demoStructure();

  const supabase = await supabaseForRequest();
  const [sections, levels, arms, classSubjects, subjects, students] = await Promise.all([
    supabase.from("sections").select("id, kind, name, assessment_style, is_enabled, sort_order").eq("school_id", school.id).order("sort_order"),
    supabase.from("class_levels").select("id, section_id, name, sort_order").eq("school_id", school.id).order("sort_order"),
    supabase.from("class_arms").select("id, class_level_id, name").eq("school_id", school.id).order("name"),
    supabase.from("class_subjects").select("class_level_id, subject_id, sort_order").eq("school_id", school.id).order("sort_order"),
    supabase.from("subjects").select("id, name").eq("school_id", school.id).eq("is_active", true).order("name"),
    fetchAll<{ class_arm_id: string | null }>((a, b) => supabase.from("students").select("class_arm_id").eq("school_id", school.id).eq("status", "active").order("id").range(a, b)),
  ]);
  for (const [what, r] of [["sections", sections], ["classes", levels], ["arms", arms], ["class subjects", classSubjects], ["subjects", subjects], ["students", students]] as const) {
    if (r.error) fail(what, r.error);
  }

  const perArm = new Map<string, number>();
  for (const s of students.data ?? []) if (s.class_arm_id) perArm.set(s.class_arm_id, (perArm.get(s.class_arm_id) ?? 0) + 1);

  return {
    subjects: (subjects.data ?? []).map((s) => ({ id: s.id, name: s.name })),
    sections: (sections.data ?? []).map((s) => ({
      id: s.id,
      kind: s.kind as SectionKind,
      name: s.name,
      assessmentStyle: s.assessment_style as "score" | "rating",
      isEnabled: s.is_enabled,
      levels: (levels.data ?? [])
        .filter((l) => l.section_id === s.id)
        .map((l) => ({
          id: l.id,
          name: l.name,
          arms: (arms.data ?? []).filter((a) => a.class_level_id === l.id).map((a) => ({ id: a.id, name: a.name, students: perArm.get(a.id) ?? 0 })),
          subjectIds: (classSubjects.data ?? []).filter((cs) => cs.class_level_id === l.id).map((cs) => cs.subject_id),
        })),
    })),
  };
});

export const getGrading = cache(async (school: School): Promise<SectionGrading[]> => {
  if (IS_DEMO) {
    return DEMO_STRUCTURE.filter((s) => s.assessmentStyle === "score").map((s) => ({
      sectionId: s.id,
      sectionName: s.name,
      kind: s.kind as SectionKind,
      components: DEFAULT_COMPONENTS.map((c, i) => ({ id: `${s.id}-c${i}`, ...c })),
      scale: { id: `${s.id}-scale`, name: s.kind === "senior_secondary" ? "WAEC scale" : "Standard scale", bands: s.kind === "senior_secondary" ? WAEC_SCALE : BASIC_SCALE },
    }));
  }

  const supabase = await supabaseForRequest();
  const [sections, components, scales] = await Promise.all([
    supabase.from("sections").select("id, kind, name, sort_order").eq("school_id", school.id).eq("is_enabled", true).eq("assessment_style", "score").order("sort_order"),
    supabase.from("assessment_components").select("id, section_id, name, max_score, sort_order").eq("school_id", school.id).order("sort_order"),
    supabase.from("grading_scales").select("id, section_id, name, bands").eq("school_id", school.id),
  ]);
  for (const [what, r] of [["sections", sections], ["CA and exam settings", components], ["grading scales", scales]] as const) {
    if (r.error) fail(what, r.error);
  }

  return (sections.data ?? []).map((s) => {
    const scale = (scales.data ?? []).find((g) => g.section_id === s.id);
    const kind = s.kind as SectionKind;
    return {
      sectionId: s.id,
      sectionName: s.name,
      kind,
      components: (components.data ?? []).filter((c) => c.section_id === s.id).map((c) => ({ id: c.id, name: c.name, maxScore: Number(c.max_score) })),
      scale: scale
        ? { id: scale.id, name: scale.name, bands: scale.bands as GradeBand[] }
        : { id: null, name: kind === "senior_secondary" ? "WAEC scale" : "Standard scale", bands: kind === "senior_secondary" ? WAEC_SCALE : BASIC_SCALE },
    };
  });
});
