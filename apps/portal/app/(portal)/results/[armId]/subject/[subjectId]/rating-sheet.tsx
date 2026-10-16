"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { Card, CardHeader, cx } from "@kmf/ui";
import type { ClassStudent } from "@/lib/results";
import { saveRatings } from "../../../actions";
import { SaveStatusPill } from "./save-status";
import { useAutosave } from "./use-autosave";

type Entry = { studentId: string; rating: string | null };

/** For nursery: tap a rating for each pupil. Saves by itself. */
export function RatingSheet({
  termId,
  armId,
  subjectId,
  title,
  subtitle,
  students,
  options,
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
  options: string[];
  initial: Record<string, string>;
  locked: boolean;
  lockReason: string | null;
}) {
  const [values, setValues] = useState<Record<string, string>>(initial);
  const send = useCallback(async (entries: Entry[]) => ({ error: (await saveRatings({ termId, armId, subjectId, entries })).error }), [armId, subjectId, termId]);
  const keyOf = useCallback((e: Entry) => e.studentId, []);
  const { push, flush, restore, status, error } = useAutosave<Entry>({ storageKey: `kmf-ratings:${termId}:${armId}:${subjectId}`, keyOf, send, delay: 800 });

  useEffect(() => {
    if (locked) return;
    const left = restore();
    if (!left.length) return;
    void Promise.resolve().then(() => {
      setValues((v) => ({ ...v, ...Object.fromEntries(left.map((e) => [e.studentId, e.rating ?? ""])) }));
      void flush();
    });
  }, [flush, locked, restore]);

  const pick = (studentId: string, rating: string) => {
    const next = values[studentId] === rating ? "" : rating; // tap again to clear
    setValues((v) => ({ ...v, [studentId]: next }));
    push({ studentId, rating: next || null });
  };

  const done = students.filter((s) => values[s.id]).length;

  return (
    <Card>
      <CardHeader title={title} description={`${subtitle} · ${done} of ${students.length} rated`} />
      <div className="space-y-3 px-5 pt-4 sm:px-6">
        {locked ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-surface-sunk px-3 py-2 text-sm font-semibold text-ink-muted">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden /> {lockReason}
          </p>
        ) : (
          <SaveStatusPill status={status} error={error} onRetry={() => void flush()} />
        )}
      </div>
      <ul className="mt-2 divide-y divide-line">
        {students.map((s) => (
          <li key={s.id} className="px-5 py-3 sm:px-6">
            <p className="font-semibold">{s.name}</p>
            <div role="radiogroup" aria-label={`Rating for ${s.name}`} className="mt-2 flex flex-wrap gap-1.5">
              {options.map((o) => {
                const on = values[s.id] === o;
                return (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={locked}
                    onClick={() => pick(s.id, o)}
                    className={cx(
                      "h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors disabled:opacity-70",
                      on ? "border-brand bg-brand text-brand-on" : "border-line-strong bg-surface text-ink hover:border-brand hover:bg-brand-wash",
                    )}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
