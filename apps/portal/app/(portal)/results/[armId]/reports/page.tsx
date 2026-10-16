import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { computeClassResults, suggestedComment } from "@kmf/core";
import { Card, CardHeader, EmptyState, buttonClasses, cx } from "@kmf/ui";
import { getClassTermData, getReportSettings, getTraits } from "@/lib/results";
import { loadClass } from "../load";
import { ReportForm } from "./report-form";

export const metadata: Metadata = { title: "Attendance and comments" };

export default async function ReportsPage({ params, searchParams }: { params: Promise<{ armId: string }>; searchParams: Promise<{ term?: string; student?: string }> }) {
  const { armId } = await params;
  const { term: termParam, student: studentParam } = await searchParams;
  const { school, cls, term, access } = await loadClass(armId, termParam);
  if (!access.manage && !access.formTeacher) redirect(`/results/${armId}?term=${term.id}`);

  const [data, traits, settings] = await Promise.all([getClassTermData(school, cls, term), getTraits(school), getReportSettings(school)]);
  const back = (
    <Link href={`/results/${cls.id}?term=${term.id}`} className={buttonClasses("ghost", "sm")}>
      <ArrowLeft className="size-4" aria-hidden /> {cls.label}
    </Link>
  );
  if (cls.students.length === 0) {
    return (
      <div className="space-y-4">
        {back}
        <Card>
          <EmptyState title="No students in this class">Add students to this class first.</EmptyState>
        </Card>
      </div>
    );
  }

  const index = Math.max(0, cls.students.findIndex((s) => s.id === studentParam));
  const student = cls.students[index]!;
  const report = data.reports[student.id];
  const average =
    cls.style === "score"
      ? computeClassResults({ studentIds: cls.students.map((s) => s.id), subjectIds: cls.subjects.map((s) => s.id), components: cls.components, scores: data.scores, bands: cls.bands }).students[index]!.average
      : null;
  const next = cls.students[index + 1];
  const prev = cls.students[index - 1];
  const link = (id: string) => `/results/${cls.id}/reports?term=${term.id}&student=${id}`;

  return (
    <div className="space-y-4">
      {back}
      <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <Card className="hidden self-start lg:block">
          <CardHeader title="Students" description={`${cls.students.filter((s) => data.reports[s.id]?.teacherComment).length} of ${cls.students.length} done`} />
          <ul className="max-h-[70vh] overflow-y-auto py-2">
            {cls.students.map((s) => (
              <li key={s.id}>
                <Link
                  href={link(s.id)}
                  aria-current={s.id === student.id ? "page" : undefined}
                  className={cx("flex items-center gap-2 px-5 py-2 text-sm hover:bg-brand-wash", s.id === student.id && "bg-brand-soft font-bold text-brand-text")}
                >
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  {data.reports[s.id]?.teacherComment ? <Check className="size-4 shrink-0 text-ok" aria-label="Done" /> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <ReportForm
          key={student.id}
          termId={term.id}
          armId={cls.id}
          student={{ id: student.id, name: student.name, admissionNo: student.admissionNo }}
          position={{ index, count: cls.students.length, prevHref: prev ? link(prev.id) : null, nextHref: next ? link(next.id) : null }}
          students={cls.students.map((s) => ({ id: s.id, name: s.name, href: link(s.id) }))}
          daysOpen={term.daysOpen}
          traits={traits}
          initial={{
            daysPresent: report?.daysPresent ?? null,
            teacherComment: report?.teacherComment ?? "",
            headComment: report?.headComment ?? "",
            traits: report?.traits ?? {},
          }}
          suggestion={suggestedComment(average)}
          average={average}
          canWriteHead={access.manage}
          headTitle={settings.headTitle}
          locked={Boolean(data.release)}
        />
      </div>
    </div>
  );
}
