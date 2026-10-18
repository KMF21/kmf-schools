import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ClipboardList, Lock, PencilLine, Printer, Users } from "lucide-react";
import { computeClassResults, ordinal } from "@kmf/core";
import { Badge, Card, CardHeader, buttonClasses } from "@kmf/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form-bits";
import { getPublishStatus } from "@/lib/billing";
import { formatDate, formatNaira } from "@/lib/format";
import { getStaffList } from "@/lib/people";
import { getClassTermData } from "@/lib/results";
import { publishClass, unpublishClass } from "../actions";
import { TermPicker } from "../term-picker";
import { loadClass } from "./load";
import { TeachersForm } from "./teachers-form";

export const metadata: Metadata = { title: "Class results" };

export default async function ClassResultsPage({ params, searchParams }: { params: Promise<{ armId: string }>; searchParams: Promise<{ term?: string }> }) {
  const { armId } = await params;
  const { term: termParam } = await searchParams;
  const { school, viewer, cls, term, terms, access } = await loadClass(armId, termParam);
  if (!access.manage && !access.formTeacher && access.subjectIds.length === 0) redirect("/results");

  const [data, billing] = await Promise.all([
    getClassTermData(school, cls, term),
    access.manage ? getPublishStatus(school, term, viewer.isPlatformAdmin) : Promise.resolve(null),
  ]);
  const q = `?term=${term.id}`;
  const published = Boolean(data.release);
  const canSeeAll = access.manage || access.formTeacher;
  const studentIds = cls.students.map((s) => s.id);

  const results =
    cls.style === "score"
      ? computeClassResults({ studentIds, subjectIds: cls.subjects.map((s) => s.id), components: cls.components, scores: data.scores, bands: cls.bands })
      : null;

  // How many students have a complete result in each subject.
  const progress = new Map(
    cls.subjects.map((sub, i) => [
      sub.id,
      cls.style === "score"
        ? results!.students.filter((r) => r.subjects[i]!.complete).length
        : cls.students.filter((st) => data.ratings[st.id]?.[sub.id]).length,
    ]),
  );
  const reportsDone = cls.students.filter((s) => data.reports[s.id]?.teacherComment).length;
  const unfinished = cls.subjects.filter((s) => (progress.get(s.id) ?? 0) < cls.students.length).length;
  const publishWarning = unfinished
    ? ` ${unfinished} ${unfinished === 1 ? "subject is" : "subjects are"} not complete yet; missing scores will show as blank.`
    : "";
  const staff = access.manage ? (await getStaffList(school)).staff.filter((s) => s.isActive) : [];

  return (
    <div className="space-y-4">
      <Link href={`/results${q}`} className={buttonClasses("ghost", "sm")}>
        <ArrowLeft className="size-4" aria-hidden /> All classes
      </Link>

      <Card>
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1 basis-56">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl">{cls.label}</h1>
              {published ? (
                <Badge tone="ok">
                  <Lock className="size-3" aria-hidden /> Published {formatDate(data.release!.publishedAt)}
                </Badge>
              ) : (
                <Badge>Draft</Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              {term.label} · {cls.students.length} students · Form teacher: {cls.formTeacher?.name ?? "not assigned"}
            </p>
          </div>
          <TermPicker terms={terms.map((t) => ({ id: t.id, label: t.label }))} current={term.id} />
        </div>
        {canSeeAll ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-4 sm:px-6">
            <Link href={`/results/${cls.id}/reports${q}`} className={buttonClasses("outline", "sm")}>
              <ClipboardList className="size-4" aria-hidden /> Attendance and comments
            </Link>
            <Link href={`/results/${cls.id}/print${q}`} className={buttonClasses("outline", "sm")}>
              <Printer className="size-4" aria-hidden /> Report cards
            </Link>
            {access.manage && !published && billing && !billing.allowed ? (
              <p className="ml-auto flex basis-full items-start gap-2 rounded-[var(--radius-control)] bg-warn-soft px-3 py-2 text-sm font-semibold text-warn sm:basis-auto">
                <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
                {billing.message}
              </p>
            ) : access.manage ? (
              published ? (
                <ActionForm action={unpublishClass} hidden={{ term_id: term.id, arm_id: cls.id }} confirm="Unpublish these results? Parents and students won't see them until you publish again." className="ml-auto flex flex-wrap items-center gap-2">
                  <SubmitButton variant="outline" size="sm" pendingLabel="Unpublishing">
                    Unpublish to make changes
                  </SubmitButton>
                </ActionForm>
              ) : (
                <ActionForm action={publishClass} hidden={{ term_id: term.id, arm_id: cls.id }} confirm={`Publish ${cls.label} results? Parents and students will see them, and scores will be locked.${publishWarning}`} className="ml-auto flex flex-wrap items-center gap-2">
                  <SubmitButton size="sm" pendingLabel="Publishing">
                    Publish results
                  </SubmitButton>
                </ActionForm>
              )
            ) : null}
          </div>
        ) : null}
        {access.manage && !published && billing?.allowed && billing.invoice?.status === "unpaid" ? (
          <p className="border-t border-line px-5 py-3 text-sm text-ink-muted sm:px-6">
            KMF invoice for {billing.invoice.label}: <span className="font-bold text-ink">{formatNaira(billing.invoice.amount)}</span>, due {formatDate(billing.invoice.dueOn)}. Publishing
            stays open until then.
          </p>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Subjects"
          description={published ? "Results are published, so scores are locked." : cls.style === "rating" ? "Rate each pupil in each subject." : `Scores out of ${cls.components.map((c) => `${c.name} ${c.maxScore}`).join(", ")}.`}
        />
        {cls.subjects.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-muted sm:px-6">This class has no subjects yet. Add them under Classes and subjects.</p>
        ) : (
          <ul className="divide-y divide-line">
            {cls.subjects.map((sub) => {
              const done = progress.get(sub.id) ?? 0;
              const mine = access.subjectIds.includes(sub.id);
              const teachers = cls.subjectTeachers[sub.id]?.map((t) => t.name).join(", ");
              const pct = cls.students.length ? Math.round((done / cls.students.length) * 100) : 0;
              return (
                <li key={sub.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 sm:px-6">
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="font-bold">{sub.name}</p>
                    <p className="text-sm text-ink-muted">{teachers ?? "No subject teacher assigned"}</p>
                  </div>
                  <div className="w-36">
                    <p className="text-xs text-ink-muted tabular-nums">
                      {done} of {cls.students.length} done
                    </p>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-sunk">
                      <div className={pct === 100 ? "h-full rounded-full bg-ok" : "h-full rounded-full bg-brand"} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  {mine || canSeeAll ? (
                    <Link href={`/results/${cls.id}/subject/${sub.id}${q}`} className={buttonClasses(mine && !published ? "solid" : "outline", "sm")}>
                      {mine && !published ? (
                        <>
                          <PencilLine className="size-4" aria-hidden /> Enter {cls.style === "rating" ? "ratings" : "scores"}
                        </>
                      ) : (
                        "View"
                      )}
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {canSeeAll ? (
          <p className="border-t border-line px-5 py-3 text-sm text-ink-muted sm:px-6">
            Attendance and comments: {reportsDone} of {cls.students.length} students done.
          </p>
        ) : null}
      </Card>

      {results && canSeeAll && cls.students.length > 0 ? (
        <Card>
          <CardHeader title="Broadsheet" description="Totals for every subject, with each student's average and position in the class." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-left text-sm">
              <thead className="bg-surface-sunk text-xs text-ink-muted">
                <tr>
                  <th scope="col" className="sticky left-0 bg-surface-sunk px-5 py-3 font-bold sm:px-6">Student</th>
                  {cls.subjects.map((s) => (
                    <th key={s.id} scope="col" className="max-w-24 px-2 py-3 text-center font-bold" title={s.name}>
                      <span className="line-clamp-2">{s.name}</span>
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-3 text-center font-bold">Total</th>
                  <th scope="col" className="px-3 py-3 text-center font-bold">Average</th>
                  <th scope="col" className="px-5 py-3 text-center font-bold sm:px-6">Position</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {cls.students.map((st, i) => {
                  const r = results.students[i]!;
                  return (
                    <tr key={st.id} className="hover:bg-brand-wash">
                      <th scope="row" className="sticky left-0 bg-surface px-5 py-2 text-left font-semibold whitespace-nowrap sm:px-6">
                        <Link href={`/results/${cls.id}/report/${st.id}${q}`} className="underline-offset-4 hover:text-brand-text hover:underline">
                          {st.name}
                        </Link>
                      </th>
                      {r.subjects.map((s) => (
                        <td key={s.subjectId} className={`px-2 py-2 text-center tabular-nums ${s.total === null ? "text-ink-faint" : s.complete ? "" : "text-warn"}`}>
                          {s.total ?? "–"}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-center font-semibold tabular-nums">{r.subjectCount ? r.total : "–"}</td>
                      <td className="px-3 py-2 text-center font-semibold tabular-nums">{r.average ?? "–"}</td>
                      <td className="px-5 py-2 text-center font-bold tabular-nums sm:px-6">{r.position ? ordinal(r.position) : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-muted sm:px-6">
            Class average: <span className="font-bold text-ink">{results.classAverage ?? "–"}</span>. Totals in amber are missing a CA or exam score.
          </p>
        </Card>
      ) : null}

      {access.manage ? (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Users className="size-4" aria-hidden /> Teachers for {cls.label}
              </span>
            }
            description="The form teacher can enter every subject plus attendance and comments. Subject teachers enter only their subject."
          />
          <TeachersForm
            armId={cls.id}
            subjects={cls.subjects}
            staff={staff.map((s) => ({ id: s.id, name: [s.title, s.firstName, s.lastName].filter(Boolean).join(" ") }))}
            formTeacherId={cls.formTeacher?.id ?? null}
            assigned={Object.fromEntries(cls.subjects.map((s) => [s.id, cls.subjectTeachers[s.id]?.[0]?.id ?? ""]))}
          />
        </Card>
      ) : null}
    </div>
  );
}
