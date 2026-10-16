import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpenCheck, CalendarX, FileText } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, buttonClasses } from "@kmf/ui";
import { formatDate } from "@/lib/format";
import { getMyPublishedResults, getReleasedArms, getResultClasses, getTerms, resolveTerm } from "@/lib/results";
import { requireViewer } from "@/lib/session";
import { TermPicker } from "./term-picker";

export const metadata: Metadata = { title: "Results" };

export default async function ResultsPage({ searchParams }: { searchParams: Promise<{ term?: string }> }) {
  const { school, viewer } = await requireViewer(["owner", "admin", "teacher", "parent", "student"]);
  const isStaff = viewer.isPlatformAdmin || viewer.roles.some((r) => r === "owner" || r === "admin" || r === "teacher");

  if (!isStaff) {
    const results = await getMyPublishedResults(school, viewer);
    return (
      <Card>
        <CardHeader title="Results" description="Report cards appear here once the school publishes them." />
        {results.length === 0 ? (
          <EmptyState icon={<BookOpenCheck />} title="No results yet">
            When the school publishes this term&apos;s results, the report card will be here.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {results.map((r) => (
              <li key={`${r.studentId}-${r.termId}`}>
                <Link href={`/results/${r.armId}/report/${r.studentId}?term=${r.termId}`} className="flex items-center gap-4 px-5 py-4 hover:bg-brand-wash sm:px-6">
                  <span className="grid size-11 shrink-0 place-items-center rounded-[0.875rem] bg-brand-soft text-brand-text">
                    <FileText className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">{r.name}</span>
                    <span className="block text-sm text-ink-muted">
                      {r.termLabel} · {r.armLabel} · published {formatDate(r.publishedAt)}
                    </span>
                  </span>
                  <ArrowRight className="size-5 text-ink-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    );
  }

  const { term: termParam } = await searchParams;
  const [terms, term] = await Promise.all([getTerms(school), resolveTerm(school, termParam)]);
  if (!term) {
    return (
      <Card>
        <EmptyState
          icon={<CalendarX />}
          title="Set the current term first"
          action={
            <Link href="/settings/calendar" className={buttonClasses("solid", "sm")}>
              Set the term
            </Link>
          }
        >
          Results are recorded for a term. Ask the proprietor or school admin to set the session and term.
        </EmptyState>
      </Card>
    );
  }

  const [classes, released] = await Promise.all([getResultClasses(school, viewer), getReleasedArms(school, term.id)]);
  const sections = [...new Set(classes.map((c) => c.sectionName))];

  return (
    <Card>
      <CardHeader
        title="Results"
        description={`${term.label}. Choose a class to enter scores, add comments and print report cards.`}
        action={<TermPicker terms={terms.map((t) => ({ id: t.id, label: t.label }))} current={term.id} />}
      />
      {classes.length === 0 ? (
        <EmptyState icon={<BookOpenCheck />} title="No classes assigned to you yet">
          Ask the school admin to assign you to your classes and subjects. They do it on the results page of each class.
        </EmptyState>
      ) : (
        <div className="space-y-6 p-5 sm:p-6">
          {sections.map((section) => (
            <section key={section}>
              <h3 className="mb-2 text-sm font-extrabold tracking-[0.08em] text-ink-faint uppercase">{section}</h3>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {classes
                  .filter((c) => c.sectionName === section)
                  .map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/results/${c.id}?term=${term.id}`}
                        className="flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-line p-4 transition-colors hover:border-brand hover:bg-brand-wash"
                      >
                        <span className="min-w-0">
                          <span className="block font-[family-name:var(--font-display)] text-lg font-bold">{c.label}</span>
                          <span className="block text-sm text-ink-muted">
                            {c.students} students ·{" "}
                            {c.access.manage ? `${c.subjectCount} subjects` : c.access.formTeacher ? "Form teacher" : `${c.access.subjectIds.length} of your subjects`}
                          </span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          {released.has(c.id) ? <Badge tone="ok">Published</Badge> : <Badge>Draft</Badge>}
                          {c.access.formTeacher && !c.access.manage ? <Badge tone="brand">Your class</Badge> : null}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
