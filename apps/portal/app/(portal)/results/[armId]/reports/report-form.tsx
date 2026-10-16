"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Lock, Sparkles } from "lucide-react";
import { TRAIT_SCALE } from "@kmf/core";
import { Button, Card, Field, Input, Select, buttonClasses, cx } from "@kmf/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import type { ActionState } from "@/lib/actions";
import type { Trait } from "@/lib/results";
import { saveReport } from "../../actions";

const TEXTAREA =
  "block w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 py-3 text-ink placeholder:text-ink-faint focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none disabled:bg-surface-sunk";

export function ReportForm({
  termId,
  armId,
  student,
  position,
  students,
  daysOpen,
  traits,
  initial,
  suggestion,
  average,
  canWriteHead,
  headTitle,
  locked,
}: {
  termId: string;
  armId: string;
  student: { id: string; name: string; admissionNo: string };
  position: { index: number; count: number; prevHref: string | null; nextHref: string | null };
  students: Array<{ id: string; name: string; href: string }>;
  daysOpen: number | null;
  traits: Trait[];
  initial: { daysPresent: number | null; teacherComment: string; headComment: string; traits: Record<string, number> };
  suggestion: string;
  average: number | null;
  canWriteHead: boolean;
  headTitle: string;
  locked: boolean;
}) {
  const router = useRouter();
  const [state, action] = useActionState<ActionState, FormData>(saveReport, {});
  const [comment, setComment] = useState(initial.teacherComment);
  const [goNext, setGoNext] = useState(false);

  // After "Save and next", move on once the save succeeds.
  useEffect(() => {
    if (state.ok && goNext && position.nextHref) router.push(position.nextHref);
  }, [goNext, position.nextHref, router, state]);

  const groups: Array<{ kind: Trait["kind"]; title: string }> = [
    { kind: "behaviour", title: "Behaviour" },
    { kind: "skill", title: "Skills" },
  ];

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div className="min-w-0 flex-1 basis-48">
          <h1 className="text-xl">{student.name}</h1>
          <p className="text-sm text-ink-muted">
            {student.admissionNo} · Student {position.index + 1} of {position.count}
            {average !== null ? ` · Average ${average}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {position.prevHref ? (
            <Link href={position.prevHref} className={buttonClasses("outline", "sm")} aria-label="Previous student">
              <ChevronLeft className="size-4" aria-hidden />
            </Link>
          ) : null}
          <span className="block w-44 lg:hidden">
            <Select aria-label="Choose a student" value={student.id} onChange={(e) => router.push(students.find((s) => s.id === e.target.value)!.href)} className="h-10 text-sm">
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </span>
          {position.nextHref ? (
            <Link href={position.nextHref} className={buttonClasses("outline", "sm")} aria-label="Next student">
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>

      <form action={action} className="space-y-6 p-5 sm:p-6">
        <input type="hidden" name="term_id" value={termId} />
        <input type="hidden" name="arm_id" value={armId} />
        <input type="hidden" name="student_id" value={student.id} />
        {locked ? (
          <p className="flex items-start gap-2 rounded-[var(--radius-control)] bg-surface-sunk px-3 py-2 text-sm font-semibold text-ink-muted">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden /> These results are published, so they&apos;re locked.
          </p>
        ) : null}

        <fieldset disabled={locked} className="space-y-6">
          <Field label="Days present" htmlFor="days_present" error={state.fields?.days_present} hint={daysOpen ? `The school opened for ${daysOpen} days this term.` : "Set the days the school opened under School settings, Session and term."}>
            <span className="flex items-center gap-2">
              <span className="block w-28">
                <Input id="days_present" name="days_present" inputMode="numeric" defaultValue={initial.daysPresent ?? ""} maxLength={3} />
              </span>
              {daysOpen ? <span className="text-sm text-ink-muted">of {daysOpen}</span> : null}
            </span>
          </Field>

          {traits.length ? (
            <div className="space-y-5">
              <p className="text-sm text-ink-muted">
                Ratings: {TRAIT_SCALE.map((t) => `${t.value} ${t.label}`).join(", ")}.
              </p>
              {groups.map((g) => {
                const list = traits.filter((t) => t.kind === g.kind);
                if (!list.length) return null;
                return (
                  <fieldset key={g.kind}>
                    <legend className="mb-2 text-sm font-bold">{g.title}</legend>
                    <div className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
                      {list.map((t) => (
                        <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <span className="text-sm">{t.name}</span>
                          <span role="radiogroup" aria-label={t.name} className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <label key={n} className="cursor-pointer">
                                <input type="radio" name={`trait:${t.id}`} value={n} defaultChecked={initial.traits[t.id] === n} className="peer sr-only" />
                                <span
                                  className={cx(
                                    "grid size-9 place-items-center rounded-full border border-line-strong text-sm font-bold text-ink-muted",
                                    "peer-checked:border-brand peer-checked:bg-brand peer-checked:text-brand-on peer-focus-visible:ring-4 peer-focus-visible:ring-brand-soft",
                                  )}
                                >
                                  {n}
                                </span>
                              </label>
                            ))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="teacher_comment" className="text-sm font-bold">
                Form teacher&apos;s comment
              </label>
              {suggestion && comment !== suggestion ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setComment(suggestion)}>
                  <Sparkles className="size-4" aria-hidden /> Use a suggested comment
                </Button>
              ) : null}
            </div>
            <textarea id="teacher_comment" name="teacher_comment" rows={3} maxLength={400} value={comment} onChange={(e) => setComment(e.target.value)} className={TEXTAREA} />
          </div>

          {canWriteHead ? (
            <div className="space-y-1.5">
              <label htmlFor="head_comment" className="text-sm font-bold">
                {headTitle}&apos;s comment
              </label>
              <textarea id="head_comment" name="head_comment" rows={2} maxLength={400} defaultValue={initial.headComment} className={TEXTAREA} />
            </div>
          ) : initial.headComment ? (
            <p className="text-sm text-ink-muted">
              <span className="font-bold text-ink">{headTitle}&apos;s comment:</span> {initial.headComment}
            </p>
          ) : null}
        </fieldset>

        <FormMessage state={state} />
        {!locked ? (
          <div className="flex flex-wrap justify-end gap-2">
            <div onClickCapture={() => setGoNext(false)}>
              <SubmitButton variant="outline" pendingLabel="Saving">
                Save
              </SubmitButton>
            </div>
            {position.nextHref ? (
              <div onClickCapture={() => setGoNext(true)}>
                <SubmitButton pendingLabel="Saving">Save and next</SubmitButton>
              </div>
            ) : null}
          </div>
        ) : null}
      </form>
    </Card>
  );
}
