import type { School } from "@kmf/core";
import { IS_DEMO } from "./env";
import { getClassInfo, resolveTerm, type TermOption } from "./results";
import { getEditableStructure } from "./structure";
import { fetchAll, supabaseForRequest } from "./supabase";

/* Everything the "Promote students" screen needs. */

export type Destination = { armId: string; label: string; levelId: string; levelName: string; sectionName: string };
export type PromoStudent = { id: string; name: string; admissionNo: string; average: number | null };
export type PromoClass = Destination & { students: PromoStudent[]; nextLevelArms: string[]; isFinal: boolean };
export type PromotionData = {
  term: TermOption | null;
  classes: PromoClass[];
  destinations: Destination[];
  lastRun: { fromSession: string; at: string } | null;
};

export async function getPromotionData(school: School): Promise<PromotionData> {
  const [structure, term] = await Promise.all([getEditableStructure(school), resolveTerm(school, null)]);

  // All classes in school order, and the class level that follows each one.
  const levels = structure.sections.filter((s) => s.isEnabled).flatMap((s) => s.levels.map((l) => ({ ...l, sectionName: s.name })));
  const label = (l: (typeof levels)[number], armName: string) => (l.arms.length > 1 ? `${l.name}${armName}` : l.name);
  const destinations: Destination[] = levels.flatMap((l) =>
    l.arms.map((a) => ({ armId: a.id, label: label(l, a.name), levelId: l.id, levelName: l.name, sectionName: l.sectionName })),
  );

  const averages = new Map<string, number>();
  if (!IS_DEMO && term) {
    const supabase = await supabaseForRequest();
    const { data } = await fetchAll<{ student_id: string; average: number }>((a, b) =>
      supabase.rpc("session_averages", { p_school: school.id, p_session: term.sessionId }).order("student_id").range(a, b),
    );
    for (const r of data) averages.set(r.student_id, Number(r.average));
  }

  const classes: PromoClass[] = [];
  for (const [i, l] of levels.entries()) {
    const next = levels[i + 1];
    for (const a of l.arms) {
      const info = await getClassInfo(school, a.id);
      const students = (info?.students ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        admissionNo: s.admissionNo,
        average: IS_DEMO ? (info?.style === "score" ? demoAverage(s.id) : null) : (averages.get(s.id) ?? null),
      }));
      classes.push({
        armId: a.id,
        label: label(l, a.name),
        levelId: l.id,
        levelName: l.name,
        sectionName: l.sectionName,
        students,
        nextLevelArms: next ? next.arms.map((x) => x.id) : [],
        isFinal: !next,
      });
    }
  }

  let lastRun: PromotionData["lastRun"] = null;
  if (!IS_DEMO) {
    const supabase = await supabaseForRequest();
    const { data } = await supabase.from("promotion_runs").select("from_session, created_at").eq("school_id", school.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (data) lastRun = { fromSession: data.from_session, at: data.created_at };
  }

  return { term, classes: classes.filter((c) => c.students.length > 0), destinations, lastRun };
}

/** Where a class goes by default: the same arm name in the next class, or its first arm. */
export function defaultDestination(cls: PromoClass, destinations: Destination[]): string {
  if (cls.isFinal || cls.nextLevelArms.length === 0) return "graduate";
  const armName = cls.label.slice(cls.levelName.length);
  const same = cls.nextLevelArms.find((id) => destinations.find((d) => d.armId === id)?.label.endsWith(armName) && armName !== "");
  return `move:${same ?? cls.nextLevelArms[0]}`;
}

function demoAverage(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return Math.round((30 + ((h >>> 0) % 5000) / 100) * 100) / 100; // 30 to 80
}
