import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { buttonClasses } from "@kmf/ui";
import { getClassTermData } from "@/lib/results";
import { loadClass } from "../../load";
import { RatingSheet } from "./rating-sheet";
import { ScoreSheet } from "./score-sheet";

export const metadata: Metadata = { title: "Enter scores" };

export default async function SubjectScoresPage({ params, searchParams }: { params: Promise<{ armId: string; subjectId: string }>; searchParams: Promise<{ term?: string }> }) {
  const { armId, subjectId } = await params;
  const { term: termParam } = await searchParams;
  const { school, cls, term, access } = await loadClass(armId, termParam);
  const subject = cls.subjects.find((s) => s.id === subjectId);
  if (!subject) notFound();
  const mine = access.subjectIds.includes(subject.id);
  if (!mine && !access.manage && !access.formTeacher) redirect("/results");

  const data = await getClassTermData(school, cls, term);
  const locked = Boolean(data.release) || !mine;
  const lockReason = data.release ? "These results are published, so they're locked. The school admin can unpublish them to make changes." : !mine ? "You can view this subject, but it isn't assigned to you." : null;
  const common = { termId: term.id, armId: cls.id, subjectId: subject.id, students: cls.students, locked, lockReason };

  return (
    <div className="space-y-4">
      <Link href={`/results/${cls.id}?term=${term.id}`} className={buttonClasses("ghost", "sm")}>
        <ArrowLeft className="size-4" aria-hidden /> {cls.label}
      </Link>
      {cls.style === "rating" ? (
        <RatingSheet
          {...common}
          title={`${subject.name}, ${cls.label}`}
          subtitle={term.label}
          options={cls.ratingOptions}
          initial={Object.fromEntries(cls.students.map((s) => [s.id, data.ratings[s.id]?.[subject.id] ?? ""]))}
        />
      ) : (
        <ScoreSheet
          {...common}
          title={`${subject.name}, ${cls.label}`}
          subtitle={term.label}
          components={cls.components}
          bands={cls.bands}
          initial={Object.fromEntries(cls.students.map((s) => [s.id, data.scores[s.id]?.[subject.id] ?? {}]))}
        />
      )}
    </div>
  );
}
