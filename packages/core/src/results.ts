import { gradeFor, type GradeBand } from "./curriculum";

/**
 * Working out a class's results from raw scores. Pure functions, used by the
 * portal for score sheets, broadsheets and report cards, so every screen
 * computes results exactly the same way.
 */

export type ComponentDef = { id: string; name: string; maxScore: number };

/** One student's scores in one subject: component id → score. Missing means not entered. */
export type ScoreMap = Record<string, number>;

export type SubjectResult = {
  subjectId: string;
  scores: ScoreMap;
  /** Null until at least one score is entered. */
  total: number | null;
  /** True when every component has a score. */
  complete: boolean;
  grade: string | null;
  remark: string | null;
  position: number | null;
  classAverage: number | null;
  highest: number | null;
  lowest: number | null;
};

export type StudentResult = {
  studentId: string;
  subjects: SubjectResult[];
  /** Subjects with at least one score. */
  subjectCount: number;
  total: number;
  average: number | null;
  position: number | null;
};

export type ClassResults = {
  students: StudentResult[];
  classSize: number;
  classAverage: number | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Total of the entered scores, or null when nothing is entered yet. */
export function subjectTotal(scores: ScoreMap, components: ComponentDef[]): number | null {
  let total = 0;
  let any = false;
  for (const c of components) {
    const v = scores[c.id];
    if (typeof v === "number" && Number.isFinite(v)) {
      total += v;
      any = true;
    }
  }
  return any ? round2(total) : null;
}

/**
 * Competition ranking: equal values share a position and the next one skips
 * (1, 2, 2, 4), as on Nigerian report cards. Higher is better; nulls get no position.
 */
export function rankWithTies(values: Array<number | null>): Array<number | null> {
  const present = values.filter((v): v is number => v !== null).sort((a, b) => b - a);
  return values.map((v) => (v === null ? null : present.findIndex((p) => Math.abs(p - v) < 1e-9) + 1));
}

/** 1 → "1st", 2 → "2nd", 11 → "11th", 22 → "22nd". */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** Checks one score against its component. Returns a problem in plain words, or null. */
export function scoreProblem(value: number, component: ComponentDef): string | null {
  if (!Number.isFinite(value)) return "Enter a number.";
  if (value < 0) return "Scores can't be below 0.";
  if (value > component.maxScore) return `${component.name} is out of ${component.maxScore}.`;
  if (Math.round(value * 100) !== value * 100) return "Use at most two decimal places.";
  return null;
}

/**
 * Results for a class (one arm, one term).
 * @param scores studentId → subjectId → ScoreMap
 */
export function computeClassResults(input: {
  studentIds: string[];
  subjectIds: string[];
  components: ComponentDef[];
  scores: Record<string, Record<string, ScoreMap>>;
  bands: GradeBand[];
}): ClassResults {
  const { studentIds, subjectIds, components, scores, bands } = input;

  // Per-subject statistics and positions across the class.
  const perSubject = new Map<string, { totals: Array<number | null>; positions: Array<number | null>; avg: number | null; high: number | null; low: number | null }>();
  for (const subjectId of subjectIds) {
    const totals = studentIds.map((s) => subjectTotal(scores[s]?.[subjectId] ?? {}, components));
    const present = totals.filter((t): t is number => t !== null);
    perSubject.set(subjectId, {
      totals,
      positions: rankWithTies(totals),
      avg: present.length ? round1(present.reduce((a, b) => a + b, 0) / present.length) : null,
      high: present.length ? Math.max(...present) : null,
      low: present.length ? Math.min(...present) : null,
    });
  }

  const students: StudentResult[] = studentIds.map((studentId, i) => {
    const subjects: SubjectResult[] = subjectIds.map((subjectId) => {
      const stats = perSubject.get(subjectId)!;
      const total = stats.totals[i] ?? null;
      const map = scores[studentId]?.[subjectId] ?? {};
      const band = total === null ? undefined : gradeFor(total, bands);
      return {
        subjectId,
        scores: map,
        total,
        complete: components.every((c) => typeof map[c.id] === "number"),
        grade: band?.grade ?? null,
        remark: band?.remark ?? null,
        position: stats.positions[i] ?? null,
        classAverage: stats.avg,
        highest: stats.high,
        lowest: stats.low,
      };
    });
    const taken = subjects.filter((s) => s.total !== null);
    const total = round2(taken.reduce((a, s) => a + s.total!, 0));
    return {
      studentId,
      subjects,
      subjectCount: taken.length,
      total,
      average: taken.length ? round2(total / taken.length) : null,
      position: null,
    };
  });

  const positions = rankWithTies(students.map((s) => s.average));
  students.forEach((s, i) => (s.position = positions[i] ?? null));
  const averages = students.map((s) => s.average).filter((a): a is number => a !== null);

  return {
    students,
    classSize: studentIds.length,
    classAverage: averages.length ? round2(averages.reduce((a, b) => a + b, 0) / averages.length) : null,
  };
}

/**
 * Third-term (yearly) figures for one subject: each term's total and the average
 * of the terms that have a total. E.g. 60, 70, 80 → 70.
 */
export function cumulative(termTotals: Array<number | null>): { average: number | null; termsCounted: number } {
  const present = termTotals.filter((t): t is number => t !== null);
  return { average: present.length ? round2(present.reduce((a, b) => a + b, 0) / present.length) : null, termsCounted: present.length };
}

/* --------------------------------------------------- Behaviour and skills */

export type TraitKind = "behaviour" | "skill";

/** Standard list each school can edit, as on most Nigerian report cards. */
export const DEFAULT_TRAITS: Array<{ kind: TraitKind; name: string }> = [
  { kind: "behaviour", name: "Punctuality" },
  { kind: "behaviour", name: "Neatness" },
  { kind: "behaviour", name: "Politeness" },
  { kind: "behaviour", name: "Honesty" },
  { kind: "behaviour", name: "Relationship with others" },
  { kind: "behaviour", name: "Attentiveness" },
  { kind: "behaviour", name: "Self-control" },
  { kind: "skill", name: "Handwriting" },
  { kind: "skill", name: "Verbal fluency" },
  { kind: "skill", name: "Sports and games" },
  { kind: "skill", name: "Drawing and crafts" },
  { kind: "skill", name: "Musical skills" },
];

/** 5 is best. Labels printed in the key under the ratings. */
export const TRAIT_SCALE: Array<{ value: number; label: string }> = [
  { value: 5, label: "Excellent" },
  { value: 4, label: "Very good" },
  { value: 3, label: "Good" },
  { value: 2, label: "Fair" },
  { value: 1, label: "Poor" },
];

/** A ready comment for the form teacher, from the student's average. Editable before saving. */
export function suggestedComment(average: number | null): string {
  if (average === null) return "";
  if (average >= 75) return "An excellent result. Keep it up.";
  if (average >= 65) return "A very good result. Well done.";
  if (average >= 55) return "A good result. You can do even better.";
  if (average >= 45) return "A fair result. More effort is needed.";
  return "Below expectation. Needs serious improvement and closer attention.";
}
