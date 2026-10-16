import { computeClassResults, cumulative, gradeFor, type ScoreMap, type School, type StudentResult } from "@kmf/core";
import { IS_DEMO } from "./env";
import {
  getClassTermData,
  getEarlierTermTotals,
  getReportSettings,
  getTraits,
  type ClassInfo,
  type ClassStudent,
  type ReportSettings,
  type TermOption,
  type TermReport,
  type Trait,
} from "./results";
import { supabaseForRequest } from "./supabase";

/** Everything printed on one report card. */
export type ReportCardData = {
  student: ClassStudent;
  result: StudentResult | null;
  ratings: Record<string, string>;
  report: TermReport | null;
  classSize: number;
  overallGrade: string | null;
  /** Third term: totals from first and second term, and the yearly average per subject. */
  earlier: { labels: string[]; bySubject: Record<string, { totals: Array<number | null>; average: number | null }> } | null;
};

export type ReportCardContext = {
  school: School;
  cls: ClassInfo;
  term: TermOption;
  settings: ReportSettings;
  traits: Trait[];
  published: boolean;
  cards: ReportCardData[];
};

function earlierFor(
  term: TermOption,
  cls: ClassInfo,
  earlier: { terms: TermOption[]; totals: Record<string, Record<string, Array<number | null>>> },
  studentId: string,
  result: StudentResult | null,
): ReportCardData["earlier"] {
  if (term.number !== 3 || cls.style !== "score") return null;
  const labels = earlier.terms.map((t) => (t.number === 1 ? "1st term" : "2nd term"));
  const bySubject: NonNullable<ReportCardData["earlier"]>["bySubject"] = {};
  for (const sub of cls.subjects) {
    const before = earlier.totals[studentId]?.[sub.id] ?? earlier.terms.map(() => null);
    const now = result?.subjects.find((s) => s.subjectId === sub.id)?.total ?? null;
    bySubject[sub.id] = { totals: before, average: cumulative([...before, now]).average };
  }
  return { labels, bySubject };
}

/** Report cards for a whole class, as staff see them (managers and form teachers). */
export async function classReportCards(school: School, cls: ClassInfo, term: TermOption, onlyStudentId?: string): Promise<ReportCardContext> {
  const [data, settings, traits] = await Promise.all([getClassTermData(school, cls, term), getReportSettings(school), getTraits(school)]);
  const results =
    cls.style === "score"
      ? computeClassResults({ studentIds: cls.students.map((s) => s.id), subjectIds: cls.subjects.map((s) => s.id), components: cls.components, scores: data.scores, bands: cls.bands })
      : null;
  const earlier = await getEarlierTermTotals(school, cls, term);

  const cards = cls.students
    .map((student, i) => {
      const result = results?.students[i] ?? null;
      return {
        student,
        result,
        ratings: data.ratings[student.id] ?? {},
        report: data.reports[student.id] ?? null,
        classSize: cls.students.length,
        overallGrade: result?.average != null ? (gradeFor(result.average, cls.bands)?.grade ?? null) : null,
        earlier: earlierFor(term, cls, earlier, student.id, result),
      };
    })
    .filter((c) => !onlyStudentId || c.student.id === onlyStudentId);

  return { school, cls, term, settings, traits, published: Boolean(data.release), cards };
}

/**
 * One student's report card, as their parent or the student sees it. The class
 * figures (averages, positions) come from the database with classmates anonymous.
 * Returns null when the report isn't published or isn't theirs.
 */
export async function ownReportCard(school: School, cls: ClassInfo, term: TermOption, studentId: string): Promise<ReportCardContext | null> {
  if (IS_DEMO) {
    const all = await classReportCards(school, cls, term, studentId);
    return all.published && all.cards.length ? all : null;
  }

  const supabase = await supabaseForRequest();
  const [student, report, ratings, settings, traits] = await Promise.all([
    supabase.from("students").select("id, admission_no, first_name, middle_name, last_name, gender").eq("school_id", school.id).eq("id", studentId).maybeSingle(),
    supabase.from("term_reports").select("days_present, teacher_comment, head_comment, traits").eq("school_id", school.id).eq("term_id", term.id).eq("class_arm_id", cls.id).eq("student_id", studentId).maybeSingle(),
    supabase.from("ratings").select("subject_id, rating").eq("school_id", school.id).eq("term_id", term.id).eq("class_arm_id", cls.id).eq("student_id", studentId),
    getReportSettings(school),
    getTraits(school),
  ]);
  // No report row means it isn't published, or isn't this person's to see.
  if (!student.data || !report.data) return null;

  const s = student.data;
  const me: ClassStudent = { id: s.id, name: [s.last_name, s.first_name, s.middle_name].filter(Boolean).join(" "), admissionNo: s.admission_no, gender: s.gender };

  let result: StudentResult | null = null;
  let classSize = 0;
  if (cls.style === "score") {
    const { data: rows, error } = await supabase.rpc("class_scores_for_report", { p_term: term.id, p_arm: cls.id, p_student: studentId });
    if (error) return null;
    const scores: Record<string, Record<string, ScoreMap>> = {};
    for (const r of (rows ?? []) as Array<{ student_key: string; subject_id: string; component_id: string; score: number }>) {
      ((scores[r.student_key] ??= {})[r.subject_id] ??= {})[r.component_id] = Number(r.score);
    }
    const keys = Object.keys(scores);
    if (!keys.includes("me")) keys.push("me");
    const computed = computeClassResults({ studentIds: keys, subjectIds: cls.subjects.map((x) => x.id), components: cls.components, scores, bands: cls.bands });
    result = { ...computed.students[keys.indexOf("me")]!, studentId };
    classSize = Math.max(keys.length, cls.students.length);
  }

  const { count } = await supabase.from("term_reports").select("student_id", { count: "exact", head: true }).eq("school_id", school.id).eq("term_id", term.id).eq("class_arm_id", cls.id);
  // Parents can count only their own rows, so prefer the scored class size.
  classSize = Math.max(classSize, count ?? 0);

  const earlier = await getEarlierTermTotals(school, { ...cls, students: [me] }, term);
  return {
    school,
    cls,
    term,
    settings,
    traits,
    published: true,
    cards: [
      {
        student: me,
        result,
        ratings: Object.fromEntries((ratings.data ?? []).map((r) => [r.subject_id, r.rating])),
        report: { daysPresent: report.data.days_present, teacherComment: report.data.teacher_comment, headComment: report.data.head_comment, traits: (report.data.traits ?? {}) as Record<string, number> },
        classSize,
        overallGrade: result?.average != null ? (gradeFor(result.average, cls.bands)?.grade ?? null) : null,
        earlier: earlierFor(term, cls, earlier, studentId, result),
      },
    ],
  };
}
