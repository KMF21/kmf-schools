"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";
import { gradeFor, scoreProblem, subjectTotal, type ComponentDef, type GradeBand, type ScoreMap } from "@kmf/core";
import { Card, CardHeader, cx } from "@kmf/ui";
import type { ClassStudent } from "@/lib/results";
import { saveScores } from "../../../actions";
import { SaveStatusPill } from "./save-status";
import { useAutosave } from "./use-autosave";

type Entry = { studentId: string; componentId: string; score: number | null };
const cellId = (studentId: string, componentId: string) => `cell-${studentId}-${componentId}`;
const without = (o: Record<string, string>, key: string) => {
  const next = { ...o };
  delete next[key];
  return next;
};

/** Text in each box, so half-typed values like "12." stay as typed. */
type Texts = Record<string, Record<string, string>>;

export function ScoreSheet({
  termId,
  armId,
  subjectId,
  title,
  subtitle,
  students,
  components,
  bands,
  initial,
  locked,
  lockReason,
}: {
  termId: string;
  armId: string;
  subjectId: string;
  title: string;
  subtitle: string;
  students: ClassStudent[];
  components: ComponentDef[];
  bands: GradeBand[];
  initial: Record<string, ScoreMap>;
  locked: boolean;
  lockReason: string | null;
}) {
  const [texts, setTexts] = useState<Texts>(() =>
    Object.fromEntries(students.map((s) => [s.id, Object.fromEntries(components.map((c) => [c.id, initial[s.id]?.[c.id]?.toString() ?? ""]))])),
  );
  const [problems, setProblems] = useState<Record<string, string>>({});

  const send = useCallback(
    async (entries: Entry[]) => {
      const result = await saveScores({ termId, armId, subjectId, entries });
      return { error: result.error };
    },
    [armId, subjectId, termId],
  );
  const keyOf = useCallback((e: Entry) => `${e.studentId}:${e.componentId}`, []);
  const { push, flush, restore, status, error } = useAutosave<Entry>({ storageKey: `kmf-scores:${termId}:${armId}:${subjectId}`, keyOf, send });

  // Bring back anything typed but not saved last time, then send it.
  useEffect(() => {
    if (locked) return;
    const left = restore();
    if (!left.length) return;
    void Promise.resolve().then(() => {
      setTexts((t) => {
        const next = structuredClone(t);
        for (const e of left) if (next[e.studentId]) next[e.studentId]![e.componentId] = e.score === null ? "" : String(e.score);
        return next;
      });
      void flush();
    });
  }, [flush, locked, restore]);

  const change = (studentId: string, c: ComponentDef, raw: string) => {
    const value = raw.replace(",", ".").replace(/[^0-9.]/g, "");
    setTexts((t) => ({ ...t, [studentId]: { ...t[studentId], [c.id]: value } }));
    const key = cellId(studentId, c.id);
    if (value === "") {
      setProblems((p) => without(p, key));
      push({ studentId, componentId: c.id, score: null });
      return;
    }
    if (value.endsWith(".")) return; // still typing
    const n = Number(value);
    const problem = scoreProblem(n, c);
    if (problem) {
      setProblems((p) => ({ ...p, [key]: problem }));
      return;
    }
    setProblems((p) => without(p, key));
    push({ studentId, componentId: c.id, score: n });
  };

  // Enter moves down the column, like a spreadsheet.
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) => {
    if (e.key !== "Enter" && e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const nextRow = e.key === "ArrowUp" ? row - 1 : row + 1;
    const target = students[nextRow] ? cellId(students[nextRow]!.id, components[col]!.id) : null;
    if (target) (document.getElementById(target) as HTMLInputElement | null)?.select();
  };

  const totals = useMemo(
    () =>
      Object.fromEntries(
        students.map((s) => {
          const map: ScoreMap = {};
          for (const c of components) {
            const v = texts[s.id]?.[c.id];
            if (v && !problems[cellId(s.id, c.id)] && Number.isFinite(Number(v))) map[c.id] = Number(v);
          }
          const total = subjectTotal(map, components);
          return [s.id, { total, grade: total === null ? null : gradeFor(total, bands)?.grade ?? null, complete: components.every((c) => c.id in map) }];
        }),
      ),
    [bands, components, problems, students, texts],
  );
  const done = Object.values(totals).filter((t) => t.complete).length;
  const problemList = Object.values(problems);

  return (
    <Card>
      <CardHeader title={title} description={`${subtitle} · ${done} of ${students.length} complete`} />
      <div className="space-y-3 px-5 pt-4 sm:px-6">
        {locked ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-surface-sunk px-3 py-2 text-sm font-semibold text-ink-muted">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden /> {lockReason}
          </p>
        ) : (
          <>
            <SaveStatusPill status={status} error={error} onRetry={() => void flush()} />
            <p className="text-sm text-ink-muted">Scores save by themselves as you type. Press Enter to move to the next student. Leave a box empty if a student hasn&apos;t taken it.</p>
          </>
        )}
        {problemList.length ? (
          <p role="alert" className="rounded-[var(--radius-control)] bg-bad-soft px-3 py-2 text-sm font-semibold text-bad">
            {problemList.length === 1 ? problemList[0] : `${problemList.length} scores need fixing: ${[...new Set(problemList)].join(" ")}`} Those boxes aren&apos;t saved yet.
          </p>
        ) : null}
      </div>

      {students.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-muted sm:px-6">No students in this class yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <thead className="bg-surface-sunk text-xs text-ink-muted">
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-surface-sunk px-4 py-3 text-left font-bold sm:px-6">
                  Student
                </th>
                {components.map((c) => (
                  <th key={c.id} scope="col" className="px-2 py-3 text-center font-bold whitespace-nowrap">
                    {c.name}
                    <span className="block font-semibold text-ink-faint">/{c.maxScore}</span>
                  </th>
                ))}
                <th scope="col" className="px-3 py-3 text-center font-bold">Total</th>
                <th scope="col" className="px-4 py-3 text-center font-bold sm:px-6">Grade</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {students.map((s, row) => {
                const t = totals[s.id]!;
                return (
                  <tr key={s.id}>
                    <th scope="row" className="sticky left-0 z-10 max-w-40 bg-surface px-4 py-2 text-left sm:max-w-none sm:px-6">
                      <span className="block truncate font-semibold">{s.name}</span>
                      <span className="block text-xs font-normal text-ink-faint">{s.admissionNo}</span>
                    </th>
                    {components.map((c, col) => {
                      const id = cellId(s.id, c.id);
                      const bad = Boolean(problems[id]);
                      return (
                        <td key={c.id} className="px-1.5 py-1.5 text-center">
                          <input
                            id={id}
                            value={texts[s.id]?.[c.id] ?? ""}
                            onChange={(e) => change(s.id, c, e.target.value)}
                            onKeyDown={(e) => onKeyDown(e, row, col)}
                            onFocus={(e) => e.target.select()}
                            inputMode="decimal"
                            enterKeyHint="next"
                            autoComplete="off"
                            disabled={locked}
                            aria-label={`${c.name} for ${s.name}, out of ${c.maxScore}`}
                            aria-invalid={bad || undefined}
                            title={problems[id]}
                            className={cx(
                              "h-11 w-16 rounded-[0.75rem] border bg-surface text-center text-base font-semibold tabular-nums focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none disabled:bg-surface-sunk disabled:text-ink-muted",
                              bad ? "border-bad bg-bad-soft text-bad" : "border-line-strong",
                            )}
                          />
                        </td>
                      );
                    })}
                    <td className={cx("px-3 py-2 text-center font-bold tabular-nums", !t.complete && t.total !== null && "text-warn")}>{t.total ?? "–"}</td>
                    <td className="px-4 py-2 text-center font-bold sm:px-6">{t.grade ?? "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="h-4" />
    </Card>
  );
}
