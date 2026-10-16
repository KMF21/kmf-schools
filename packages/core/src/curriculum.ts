/**
 * Starter structure offered to a new school during setup.
 * Every item is editable: schools rename, remove or add their own.
 * Nothing in the system depends on these exact names.
 */

export const SECTION_KINDS = ["nursery", "primary", "junior_secondary", "senior_secondary"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export type AssessmentStyle = "score" | "rating";

export type SectionTemplate = {
  kind: SectionKind;
  name: string;
  assessmentStyle: AssessmentStyle;
  classLevels: string[];
  subjects: string[];
  /** Only for senior secondary: subjects grouped by stream, taken as electives. */
  electives?: Record<string, string[]>;
};

export const SECTION_TEMPLATES: Record<SectionKind, SectionTemplate> = {
  nursery: {
    kind: "nursery",
    name: "Nursery",
    assessmentStyle: "rating",
    classLevels: ["Pre-Nursery", "Nursery 1", "Nursery 2"],
    subjects: [
      "Language and Literacy",
      "Numeracy",
      "Social Habits",
      "Health Habits",
      "Basic Science",
      "Rhymes and Songs",
      "Creative Arts",
      "Physical Development",
    ],
  },
  primary: {
    kind: "primary",
    name: "Primary",
    assessmentStyle: "score",
    classLevels: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6"],
    subjects: [
      "English Studies",
      "Mathematics",
      "Basic Science and Technology",
      "Social and Citizenship Studies",
      "Christian Religious Studies",
      "Islamic Studies",
      "Cultural and Creative Arts",
      "Physical and Health Education",
      "Nigerian Language",
      "French",
      "Computer Studies",
      "Pre-vocational Studies",
    ],
  },
  junior_secondary: {
    kind: "junior_secondary",
    name: "Junior Secondary",
    assessmentStyle: "score",
    classLevels: ["JSS 1", "JSS 2", "JSS 3"],
    subjects: [
      "English Studies",
      "Mathematics",
      "Basic Science",
      "Basic Technology",
      "Social Studies",
      "Civic Education",
      "Christian Religious Studies",
      "Islamic Studies",
      "Cultural and Creative Arts",
      "Physical and Health Education",
      "Business Studies",
      "Agricultural Science",
      "Home Economics",
      "Computer Studies",
      "Nigerian Language",
      "French",
    ],
  },
  senior_secondary: {
    kind: "senior_secondary",
    name: "Senior Secondary",
    assessmentStyle: "score",
    classLevels: ["SS 1", "SS 2", "SS 3"],
    subjects: ["English Language", "Mathematics", "Civic Education", "Computer Studies"],
    electives: {
      Science: ["Biology", "Chemistry", "Physics", "Further Mathematics", "Agricultural Science", "Geography"],
      Arts: [
        "Literature in English",
        "Government",
        "History",
        "Christian Religious Studies",
        "Islamic Studies",
        "Nigerian Language",
      ],
      Commercial: ["Economics", "Financial Accounting", "Commerce", "Marketing", "Office Practice"],
    },
  },
};

export type GradeBand = { min: number; max: number; grade: string; remark: string };

/** WAEC-style scale, the usual default for senior secondary. */
export const WAEC_SCALE: GradeBand[] = [
  { min: 75, max: 100, grade: "A1", remark: "Excellent" },
  { min: 70, max: 74, grade: "B2", remark: "Very good" },
  { min: 65, max: 69, grade: "B3", remark: "Good" },
  { min: 60, max: 64, grade: "C4", remark: "Credit" },
  { min: 55, max: 59, grade: "C5", remark: "Credit" },
  { min: 50, max: 54, grade: "C6", remark: "Credit" },
  { min: 45, max: 49, grade: "D7", remark: "Pass" },
  { min: 40, max: 44, grade: "E8", remark: "Pass" },
  { min: 0, max: 39, grade: "F9", remark: "Fail" },
];

/** Simple A–F scale, the usual default for primary and junior secondary. */
export const BASIC_SCALE: GradeBand[] = [
  { min: 70, max: 100, grade: "A", remark: "Excellent" },
  { min: 60, max: 69, grade: "B", remark: "Very good" },
  { min: 50, max: 59, grade: "C", remark: "Good" },
  { min: 45, max: 49, grade: "D", remark: "Fair" },
  { min: 40, max: 44, grade: "E", remark: "Pass" },
  { min: 0, max: 39, grade: "F", remark: "Fail" },
];

/** Descriptive ratings for nursery (and primary, if a school prefers). */
export const DEFAULT_RATINGS = ["Excellent", "Very good", "Good", "Fair", "Needs improvement"];

/** Default CA/exam structure: two CAs of 20 and an exam of 60. */
export const DEFAULT_COMPONENTS = [
  { name: "CA 1", maxScore: 20 },
  { name: "CA 2", maxScore: 20 },
  { name: "Exam", maxScore: 60 },
];

/** Checks that a grading scale covers 0–100 without gaps or overlaps. */
export function validateScale(bands: GradeBand[]): string[] {
  const errors: string[] = [];
  const sorted = [...bands].sort((a, b) => a.min - b.min);
  if (sorted.length === 0) return ["Add at least one grade."];
  if (sorted[0]!.min !== 0) errors.push("The lowest grade must start at 0.");
  if (sorted[sorted.length - 1]!.max !== 100) errors.push("The highest grade must end at 100.");
  for (let i = 0; i < sorted.length; i++) {
    const band = sorted[i]!;
    if (band.min > band.max) errors.push(`${band.grade}: the lower score is above the upper score.`);
    const next = sorted[i + 1];
    if (next && next.min !== band.max + 1) {
      errors.push(`There is a gap or overlap between ${band.grade} and ${next.grade}.`);
    }
  }
  return errors;
}

export function gradeFor(score: number, bands: GradeBand[]): GradeBand | undefined {
  const rounded = Math.round(score);
  return bands.find((b) => rounded >= b.min && rounded <= b.max);
}
