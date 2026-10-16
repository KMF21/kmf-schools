import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Check, ClipboardList, GraduationCap, Library, Megaphone, Users } from "lucide-react";
import { MANAGER_ROLES, type School } from "@kmf/core";
import { Badge, Card, CardHeader, EmptyState, IconTile, StatTile, buttonClasses, cx } from "@kmf/ui";
import { getAnnouncements, getOverview, getStructure, type Announcement, type CurrentTerm } from "@/lib/data";
import { formatDate, formatNumber, greeting, greetingName, weeksUntil } from "@/lib/format";
import { requireViewer, type Viewer } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { school, viewer } = await requireViewer();
  const isManager = viewer.roles.some((r) => MANAGER_ROLES.includes(r));

  const [overview, announcements] = await Promise.all([getOverview(school), getAnnouncements(school, viewer.roles, 4)]);

  return (
    <div className="space-y-6">
      <Hero school={school} viewer={viewer} term={overview.term} />

      {isManager ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatTile label="Students" value={formatNumber(overview.counts.students)} note="Active this term" icon={<GraduationCap />} />
            <StatTile label="Staff" value={formatNumber(overview.counts.staff)} note="Teaching and non-teaching" icon={<Users />} tone="info" />
            <StatTile label="Classes" value={formatNumber(overview.counts.classes)} note="Including all arms" icon={<BookOpen />} tone="warn" />
            <StatTile label="Subjects" value={formatNumber(overview.counts.subjects)} note="Across all sections" icon={<Library />} tone="ok" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <SetupChecklist steps={overview.setup} />
            <Announcements items={announcements} canManage />
          </div>

          <ClassesSummary school={school} />
        </>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title={viewer.role === "teacher" ? "Your classes" : "Results"} />
            <EmptyState icon={<ClipboardList />} title={viewer.role === "teacher" ? "Score sheets will appear here" : "No results published yet"}>
              {viewer.role === "teacher"
                ? "Once the school switches on score entry, you'll see each class and subject you teach, ready for CA and exam scores."
                : "When the school publishes this term's results, they'll appear here with a report card you can download."}
            </EmptyState>
          </Card>
          <Announcements items={announcements} />
        </div>
      )}
    </div>
  );
}

function Hero({ school, viewer, term }: { school: School; viewer: Viewer; term: CurrentTerm }) {
  const weeks = weeksUntil(term?.endsOn);
  return (
    <section className="relative overflow-hidden rounded-[var(--radius-panel)] bg-brand px-6 py-7 text-brand-on shadow-[var(--shadow-brand)] sm:px-9 sm:py-9">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-[0.12]"
        style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1.2px)", backgroundSize: "18px 18px", maskImage: "linear-gradient(to left, black, transparent)" }}
      />
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-72 rounded-full border-[2.75rem] border-white/8" />

      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0 max-w-2xl">
          <p className="text-sm font-semibold text-white/80">{school.name}</p>
          <h1 className="mt-1 text-[1.75rem] text-white sm:text-[2.25rem]">
            {greeting()}, {greetingName(viewer.name)}
          </h1>
          <p className="mt-2 text-[0.9375rem] text-white/85">
            {term
              ? `${term.name} of the ${term.session} session runs until ${formatDate(term.endsOn, { day: "numeric", month: "long" })}.`
              : "The current term hasn't been set yet."}
          </p>
        </div>

        {term ? (
          <dl className="flex gap-3">
            <div className="rounded-[1.125rem] bg-white/14 px-5 py-3.5 backdrop-blur-sm">
              <dt className="text-xs font-semibold text-white/75">Weeks left this term</dt>
              <dd className="mt-0.5 font-[family-name:var(--font-display)] text-3xl font-bold tabular-nums">{weeks ?? "-"}</dd>
            </div>
            <div className="hidden rounded-[1.125rem] bg-white/14 px-5 py-3.5 backdrop-blur-sm sm:block">
              <dt className="text-xs font-semibold text-white/75">Next term begins</dt>
              <dd className="mt-1.5 font-[family-name:var(--font-display)] text-lg font-bold">{formatDate(term.nextTermBegins, { day: "numeric", month: "short", year: "numeric" })}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </section>
  );
}

function SetupChecklist({ steps }: { steps: Array<{ key: string; title: string; description: string; done: boolean }> }) {
  const done = steps.filter((s) => s.done).length;
  const nextKey = steps.find((s) => !s.done)?.key;
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Getting your school ready"
        description={done === steps.length ? "Everything is set up." : `${done} of ${steps.length} steps done`}
        action={
          <div className="h-2 w-28 overflow-hidden rounded-full bg-surface-sunk" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Setup progress">
            <div className="h-full rounded-full bg-brand" style={{ width: `${(done / steps.length) * 100}%` }} />
          </div>
        }
      />
      <ol className="divide-y divide-line">
        {steps.map((step, i) => {
          const isNext = step.key === nextKey;
          return (
            <li key={step.key} className={cx("flex items-start gap-4 px-5 py-4 sm:px-6", isNext && "bg-brand-wash")}>
              <span
                className={cx(
                  "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                  step.done ? "bg-brand text-brand-on" : isNext ? "border-2 border-brand text-brand-text" : "border border-line-strong text-ink-faint",
                )}
              >
                {step.done ? <Check className="size-4" aria-label="Done" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cx("font-bold", step.done ? "text-ink-muted" : "text-ink")}>{step.title}</p>
                <p className="text-sm text-ink-muted">{step.description}</p>
              </div>
              {isNext ? <Badge tone="brand">Next</Badge> : null}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

const AUDIENCE: Record<string, string> = { everyone: "Everyone", staff: "Staff", parents: "Parents", public: "Public" };

function Announcements({ items, canManage = false }: { items: Announcement[]; canManage?: boolean }) {
  return (
    <Card className="flex flex-col">
      <CardHeader title="Announcements" action={<Link href="/announcements" className={buttonClasses("outline", "sm")}>View all</Link>} />
      {items.length === 0 ? (
        <EmptyState icon={<Megaphone />} title="No announcements yet">
          {canManage ? "Post term dates, events and reminders here for staff and parents." : "School news will appear here."}
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((a) => (
            <li key={a.id} className="px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold text-ink">{a.title}</p>
                {canManage ? <Badge tone={a.audience === "staff" ? "info" : "neutral"}>{AUDIENCE[a.audience] ?? a.audience}</Badge> : null}
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{a.body}</p>
              <p className="mt-1.5 text-xs text-ink-faint">{formatDate(a.publishedAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function ClassesSummary({ school }: { school: School }) {
  const structure = await getStructure(school);
  return (
    <Card>
      <CardHeader title="Classes at a glance" description="Students in each class this term" action={<Link href="/classes" className={buttonClasses("outline", "sm")}>Manage classes</Link>} />
      {structure.length === 0 ? (
        <EmptyState icon={<BookOpen />} title="No classes yet">Choose your sections and classes to get started.</EmptyState>
      ) : (
        <div className="grid gap-px overflow-hidden rounded-b-[var(--radius-card)] bg-line sm:grid-cols-2 xl:grid-cols-4">
          {structure.map((section) => {
            const total = section.levels.reduce((n, l) => n + l.arms.reduce((m, a) => m + a.students, 0), 0);
            const max = Math.max(1, ...section.levels.map((l) => l.arms.reduce((m, a) => m + a.students, 0)));
            return (
              <div key={section.id} className="bg-surface px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                  <IconTile className="size-9 rounded-[0.75rem] [&>svg]:size-4">
                    <GraduationCap />
                  </IconTile>
                  <div>
                    <p className="font-bold">{section.name}</p>
                    <p className="text-xs text-ink-muted">{formatNumber(total)} students</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-2.5">
                  {section.levels.map((level) => {
                    const count = level.arms.reduce((m, a) => m + a.students, 0);
                    return (
                      <li key={level.id} className="grid grid-cols-[4.75rem_1fr_2rem] items-center gap-3 text-sm">
                        <span className="truncate text-ink-muted">{level.name}</span>
                        <span className="h-2 overflow-hidden rounded-full bg-surface-sunk">
                          <span className="block h-full rounded-full bg-brand" style={{ width: `${(count / max) * 100}%` }} />
                        </span>
                        <span className="text-right font-bold tabular-nums">{count}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
