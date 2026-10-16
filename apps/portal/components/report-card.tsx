import { TRAIT_SCALE, ordinal } from "@kmf/core";
import { cx } from "@kmf/ui";
import { formatDate } from "@/lib/format";
import type { ReportCardContext, ReportCardData } from "@/lib/report-cards";
import { SchoolMark } from "./school-mark";

/**
 * One student's report card, sized for A4 portrait. Uses the school's colours
 * and logo; prints one card per page.
 */
export function ReportCard({ ctx, card }: { ctx: ReportCardContext; card: ReportCardData }) {
  const { school, cls, term, settings, traits } = ctx;
  const { student, result, report } = card;
  const score = cls.style === "score";
  const third = card.earlier;
  const showPos = settings.showPosition && score;
  const th = "border border-line px-1.5 py-1 text-[0.6875rem] font-bold print:border-black/30 print:py-0.5";
  const td = "border border-line px-1.5 py-1 text-center tabular-nums print:border-black/30 print:py-[1px] print:text-[0.75rem]";

  const info: Array<[string, string]> = [
    ["Name", student.name],
    ["Admission no.", student.admissionNo],
    ["Class", cls.label],
    ["Gender", student.gender === "female" ? "Female" : student.gender === "male" ? "Male" : "–"],
    ["Term", term.name],
    ["Session", term.session],
    ["Attendance", report?.daysPresent != null ? (term.daysOpen ? `${report.daysPresent} of ${term.daysOpen} days` : `${report.daysPresent} days`) : "–"],
    ["Number in class", String(card.classSize || "–")],
  ];
  if (score) {
    info.push(["Average", result?.average != null ? `${result.average}%` : "–"]);
    if (showPos) info.push(["Position", result?.position ? `${ordinal(result.position)} of ${card.classSize}` : "–"]);
  }
  info.push(["Next term begins", term.nextTermBegins ? formatDate(term.nextTermBegins) : "To be announced"]);

  return (
    <article className="report-card mx-auto w-full max-w-[210mm] bg-surface p-5 text-[0.8125rem] text-ink sm:p-7 print:max-w-none print:bg-white print:p-0 print:text-black [print-color-adjust:exact]">
      {/* Letterhead */}
      <header className="flex items-center gap-4 border-b-4 border-brand pb-3">
        <SchoolMark school={school} size={56} />
        <div className="min-w-0 flex-1 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-xl leading-tight font-bold text-brand-strong uppercase sm:text-2xl print:text-2xl">{school.name}</h2>
          {school.motto ? <p className="text-xs italic text-ink-muted print:text-black/70">{school.motto}</p> : null}
          <p className="text-[0.6875rem] text-ink-muted print:text-black/70">{[school.address, school.phone, school.email].filter(Boolean).join(" · ")}</p>
        </div>
        <span className="hidden w-16 sm:block print:block" aria-hidden />
      </header>
      <p className="my-3 rounded-full bg-brand py-1.5 text-center text-sm font-bold tracking-[0.12em] text-brand-on uppercase">
        Report card · {term.name}, {term.session}
      </p>

      {/* Student details */}
      <dl className="grid grid-cols-1 gap-x-4 gap-y-1 min-[480px]:grid-cols-2 md:grid-cols-3 print:grid-cols-3">
        {info.map(([k, v]) => (
          <div key={k} className="flex gap-1.5 border-b border-dotted border-line-strong py-0.5 print:border-black/30">
            <dt className="shrink-0 text-ink-muted print:text-black/70">{k}:</dt>
            <dd className="min-w-0 font-bold">{v}</dd>
          </div>
        ))}
      </dl>

      {/* Subjects */}
      <div className="mt-4 overflow-x-auto print:overflow-visible">
        {score ? (
          <table className="w-full min-w-[34rem] border-collapse print:min-w-0">
            <thead className="bg-brand-soft text-brand-strong print:bg-black/5 print:text-black">
              <tr>
                <th className={cx(th, "text-left")}>Subject</th>
                {cls.components.map((c) => (
                  <th key={c.id} className={th}>
                    {c.name}
                    <span className="block font-normal">({c.maxScore})</span>
                  </th>
                ))}
                <th className={th}>
                  Total<span className="block font-normal">(100)</span>
                </th>
                {third ? (
                  <>
                    {third.labels.map((l) => (
                      <th key={l} className={th}>
                        {l}
                      </th>
                    ))}
                    <th className={th}>Year average</th>
                  </>
                ) : null}
                <th className={th}>Grade</th>
                {showPos ? <th className={th}>Position</th> : null}
                <th className={th}>Class average</th>
                {!third ? (
                  <>
                    <th className={th}>Highest</th>
                    <th className={th}>Lowest</th>
                  </>
                ) : null}
                <th className={cx(th, "text-left")}>Remark</th>
              </tr>
            </thead>
            <tbody>
              {cls.subjects.map((sub) => {
                const r = result?.subjects.find((x) => x.subjectId === sub.id);
                const y = third?.bySubject[sub.id];
                if (!r || (r.total === null && !y?.average)) return null; // subjects the student doesn't take
                return (
                  <tr key={sub.id}>
                    <td className={cx(td, "text-left font-semibold")}>{sub.name}</td>
                    {cls.components.map((c) => (
                      <td key={c.id} className={td}>
                        {r.scores[c.id] ?? "–"}
                      </td>
                    ))}
                    <td className={cx(td, "font-bold")}>{r.total ?? "–"}</td>
                    {third ? (
                      <>
                        {third.labels.map((l, i) => (
                          <td key={l} className={td}>
                            {y?.totals[i] ?? "–"}
                          </td>
                        ))}
                        <td className={cx(td, "font-bold")}>{y?.average ?? "–"}</td>
                      </>
                    ) : null}
                    <td className={cx(td, "font-bold")}>{r.grade ?? "–"}</td>
                    {showPos ? <td className={td}>{r.position ? ordinal(r.position) : "–"}</td> : null}
                    <td className={td}>{r.classAverage ?? "–"}</td>
                    {!third ? (
                      <>
                        <td className={td}>{r.highest ?? "–"}</td>
                        <td className={td}>{r.lowest ?? "–"}</td>
                      </>
                    ) : null}
                    <td className={cx(td, "text-left")}>{r.remark ?? ""}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-surface-sunk font-bold print:bg-black/5">
                <td className={cx(td, "text-left")}>Total</td>
                <td className={td} colSpan={cls.components.length + 1}>
                  {result?.subjectCount ? `${result.total} in ${result.subjectCount} subjects` : "–"}
                </td>
                <td className={cx(td, "text-left")} colSpan={(third ? third.labels.length + 1 : 0) + (showPos ? 1 : 0) + (third ? 1 : 3) + 2}>
                  Average {result?.average ?? "–"}%{card.overallGrade ? ` · Grade ${card.overallGrade}` : ""}
                  {showPos && result?.position ? ` · ${ordinal(result.position)} of ${card.classSize}` : ""}
                </td>
              </tr>
            </tfoot>
          </table>
        ) : (
          <table className="w-full border-collapse">
            <thead className="bg-brand-soft text-brand-strong print:bg-black/5 print:text-black">
              <tr>
                <th className={cx(th, "text-left")}>Learning area</th>
                <th className={cx(th, "text-left")}>Rating</th>
              </tr>
            </thead>
            <tbody>
              {cls.subjects.map((sub) => (
                <tr key={sub.id}>
                  <td className={cx(td, "text-left font-semibold")}>{sub.name}</td>
                  <td className={cx(td, "text-left")}>{card.ratings[sub.id] ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Behaviour and skills, grading key */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2 print:grid-cols-2">
        {(["behaviour", "skill"] as const).map((kind) => {
          const list = traits.filter((t) => t.kind === kind);
          if (!list.length) return null;
          return (
            <table key={kind} className="w-full border-collapse self-start">
              <thead className="bg-brand-soft text-brand-strong print:bg-black/5 print:text-black">
                <tr>
                  <th className={cx(th, "text-left")}>{kind === "behaviour" ? "Behaviour" : "Skills"}</th>
                  <th className={cx(th, "w-16")}>Rating</th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id}>
                    <td className={cx(td, "text-left")}>{t.name}</td>
                    <td className={cx(td, "font-bold")}>{report?.traits[t.id] ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })}
      </div>
      <p className="mt-2 text-[0.6875rem] text-ink-muted print:text-black/70">
        Ratings: {TRAIT_SCALE.map((t) => `${t.value} ${t.label}`).join(", ")}.
        {score && cls.bands.length ? ` Grades: ${[...cls.bands].sort((a, b) => b.min - a.min).map((b) => `${b.grade} ${b.min}–${b.max}`).join(", ")}.` : ""}
      </p>

      {/* Comments and signatures */}
      <div className="mt-4 space-y-3 print:mt-3 print:space-y-2">
        <Comment title="Form teacher's comment" text={report?.teacherComment} name={cls.formTeacher?.name ?? null} />
        <Comment title={`${settings.headTitle}'s comment`} text={report?.headComment} name={settings.headName} stampUrl={settings.stampUrl} />
      </div>
      <p className="mt-3 text-center text-[0.625rem] text-ink-faint print:text-black/50">
        {ctx.published ? "Official result" : "Draft: not yet published"} · Powered by KMF Schools
      </p>
    </article>
  );
}

function Comment({ title, text, name, stampUrl }: { title: string; text: string | null | undefined; name: string | null; stampUrl?: string | null }) {
  return (
    <div className="flex items-end gap-4 rounded-[0.75rem] border border-line p-3 print:rounded-none print:border-black/30 print:p-2">
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] font-bold text-ink-muted uppercase print:text-black/70">{title}</p>
        <p className="mt-0.5 min-h-[1.25rem] font-semibold italic">{text || " "}</p>
        <p className="mt-2 text-[0.6875rem] text-ink-muted print:text-black/70">
          {name ? `${name} · ` : ""}Signature: ____________________
        </p>
      </div>
      {stampUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={stampUrl} alt="School stamp" className="size-20 shrink-0 object-contain opacity-90" />
      ) : null}
    </div>
  );
}
