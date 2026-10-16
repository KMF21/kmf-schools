import type { Metadata } from "next";
import { BookOpen, ChevronDown, Plus, Trash2 } from "lucide-react";
import { SECTION_KINDS, SECTION_TEMPLATES } from "@kmf/core";
import { Badge, Card, CardHeader, EmptyState, Input, cx } from "@kmf/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form-bits";
import { getStructure } from "@/lib/data";
import { IS_DEMO } from "@/lib/env";
import { formatNumber } from "@/lib/format";
import { isManager, requireViewer } from "@/lib/session";
import { getEditableStructure, type EditableLevel, type EditableSection, type SubjectOption } from "@/lib/structure";
import { addArm, addClassLevel, addSection, deleteArm, deleteClassLevel, renameClassLevel, saveClassSubjects, setSectionEnabled } from "./actions";

export const metadata: Metadata = { title: "Classes and subjects" };

export default async function ClassesPage() {
  const { school, viewer } = await requireViewer(["owner", "admin", "teacher"]);
  if (!isManager(viewer)) return <ReadOnlyClasses schoolStructure={await getStructure(school)} />;

  const { sections, subjects } = await getEditableStructure(school);
  const missing = SECTION_KINDS.filter((k) => !sections.some((s) => s.kind === k));

  return (
    <div className="space-y-6">
      {IS_DEMO ? (
        <p className="rounded-[var(--radius-card)] border border-warn/30 bg-warn-soft px-5 py-3 text-sm font-semibold text-warn">
          This is the demo school, so changes here aren&apos;t saved.
        </p>
      ) : null}

      {missing.length > 0 ? (
        <Card>
          <CardHeader
            title={sections.length === 0 ? "Choose your sections" : "Add a section"}
            description="Each section comes with starter classes, subjects and grading. You can change all of it afterwards."
          />
          <ActionForm action={addSection} className="flex flex-wrap gap-2 px-5 py-4 sm:px-6">
            {missing.map((kind) => (
              <button
                key={kind}
                type="submit"
                name="kind"
                value={kind}
                className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-surface px-4 py-2 text-sm font-bold text-brand-text hover:bg-brand-wash"
              >
                <Plus className="size-4" aria-hidden /> {SECTION_TEMPLATES[kind].name}
              </button>
            ))}
          </ActionForm>
        </Card>
      ) : null}

      {sections.map((section) => (
        <SectionCard key={section.id} section={section} subjects={subjects} />
      ))}
    </div>
  );
}

function SectionCard({ section, subjects }: { section: EditableSection; subjects: SubjectOption[] }) {
  const students = section.levels.reduce((n, l) => n + l.arms.reduce((m, a) => m + a.students, 0), 0);
  return (
    <Card className={cx("overflow-hidden", !section.isEnabled && "opacity-75")}>
      <CardHeader
        title={section.name}
        description={
          section.isEnabled
            ? `${section.levels.length} classes, ${formatNumber(students)} students`
            : "Turned off. Its classes are hidden from the portal, and nothing is deleted."
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={section.assessmentStyle === "rating" ? "info" : "brand"}>
              {section.assessmentStyle === "rating" ? "Rated by skills" : "Scored with CA and exam"}
            </Badge>
            <ActionForm action={setSectionEnabled} hidden={{ id: section.id, enabled: String(!section.isEnabled) }} quietSuccess>
              <SubmitButton variant="ghost" size="sm" pendingLabel="Saving">
                {section.isEnabled ? "Turn off" : "Turn on"}
              </SubmitButton>
            </ActionForm>
          </div>
        }
      />

      {section.levels.length === 0 ? (
        <p className="px-6 py-5 text-sm text-ink-muted">No classes in this section yet. Add one below.</p>
      ) : (
        <ul className="divide-y divide-line">
          {section.levels.map((level) => (
            <LevelRow key={level.id} level={level} subjects={subjects} />
          ))}
        </ul>
      )}

      <ActionForm
        action={addClassLevel}
        hidden={{ section_id: section.id }}
        resetOnSuccess
        className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-sunk px-5 py-4 sm:px-6"
      >
        <label htmlFor={`new-level-${section.id}`} className="sr-only">
          New class name
        </label>
        <Input id={`new-level-${section.id}`} name="name" placeholder="New class, e.g. Basic 7" maxLength={40} required className="h-10 max-w-64 flex-1" />
        <SubmitButton size="sm" variant="outline" pendingLabel="Adding">
          <Plus className="size-4" aria-hidden /> Add class
        </SubmitButton>
      </ActionForm>
    </Card>
  );
}

function LevelRow({ level, subjects }: { level: EditableLevel; subjects: SubjectOption[] }) {
  const enrolled = level.arms.reduce((n, a) => n + a.students, 0);
  const subjectNames = subjects.filter((s) => level.subjectIds.includes(s.id)).map((s) => s.name);

  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 hover:bg-brand-wash sm:px-6 [&::-webkit-details-marker]:hidden">
          <span className="w-28 font-bold text-ink">{level.name}</span>
          <span className="flex flex-wrap gap-1.5">
            {level.arms.map((arm) => (
              <span key={arm.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-sunk px-2.5 py-0.5 text-xs">
                <span className="font-bold">{arm.name}</span>
                <span className="text-ink-muted tabular-nums">{arm.students}</span>
              </span>
            ))}
          </span>
          <span className="flex-1 text-sm text-ink-muted">{subjectNames.length} subjects</span>
          <span className="inline-flex items-center gap-1 text-sm font-bold text-brand-text">
            Edit <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </span>
        </summary>

        <div className="grid gap-6 border-t border-line bg-surface-sunk px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="space-y-5">
            <ActionForm action={renameClassLevel} hidden={{ id: level.id }} className="space-y-1.5">
              <label htmlFor={`rename-${level.id}`} className="block text-sm font-bold">
                Class name
              </label>
              <div className="flex gap-2">
                <Input id={`rename-${level.id}`} name="name" defaultValue={level.name} maxLength={40} required className="h-10" />
                <SubmitButton size="sm" variant="outline" pendingLabel="Saving">
                  Rename
                </SubmitButton>
              </div>
            </ActionForm>

            <div className="space-y-2">
              <p className="text-sm font-bold">Arms</p>
              <ul className="space-y-1.5">
                {level.arms.map((arm) => (
                  <li key={arm.id}>
                    <ActionForm
                      action={deleteArm}
                      hidden={{ id: arm.id }}
                      confirm={`Remove arm ${arm.name} from ${level.name}?`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2"
                    >
                      <span className="text-sm">
                        <span className="font-bold">
                          {level.name}
                          {arm.name}
                        </span>{" "}
                        <span className="text-ink-muted">
                          {arm.students} student{arm.students === 1 ? "" : "s"}
                        </span>
                      </span>
                      <SubmitButton size="sm" variant="ghost" pendingLabel="Removing">
                        <Trash2 className="size-4" aria-hidden />
                        <span className="sr-only">Remove arm {arm.name}</span>
                      </SubmitButton>
                    </ActionForm>
                  </li>
                ))}
              </ul>
              <ActionForm action={addArm} hidden={{ level_id: level.id }} resetOnSuccess className="flex flex-wrap gap-2">
                <label htmlFor={`arm-${level.id}`} className="sr-only">
                  New arm name
                </label>
                <Input id={`arm-${level.id}`} name="name" placeholder="New arm, e.g. B or Gold" maxLength={40} required className="h-10 max-w-48 flex-1" />
                <SubmitButton size="sm" variant="outline" pendingLabel="Adding">
                  Add arm
                </SubmitButton>
              </ActionForm>
            </div>

            <ActionForm
              action={deleteClassLevel}
              hidden={{ id: level.id }}
              confirm={`Remove ${level.name} and its arms? This can't be undone.`}
              className="border-t border-line pt-4"
            >
              <SubmitButton size="sm" variant="ghost" pendingLabel="Removing" className="text-bad hover:bg-bad-soft hover:text-bad">
                <Trash2 className="size-4" aria-hidden /> Remove {level.name}
              </SubmitButton>
              {enrolled > 0 ? <p className="mt-1 text-xs text-ink-muted">Classes with students can&apos;t be removed.</p> : null}
            </ActionForm>
          </div>

          <ActionForm action={saveClassSubjects} hidden={{ level_id: level.id }} className="space-y-3">
            <fieldset>
              <legend className="mb-2 text-sm font-bold">Subjects taken in {level.name}</legend>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {subjects.map((s) => (
                  <label key={s.id} className="flex items-center gap-2.5 rounded-[0.625rem] px-2 py-1.5 text-sm hover:bg-surface">
                    <input type="checkbox" name="subject" value={s.id} defaultChecked={level.subjectIds.includes(s.id)} className="size-4 accent-[var(--brand)]" />
                    {s.name}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="space-y-1.5">
              <label htmlFor={`new-subjects-${level.id}`} className="block text-sm font-bold">
                Add new subjects
              </label>
              <textarea
                id={`new-subjects-${level.id}`}
                name="new_subjects"
                rows={2}
                placeholder="One per line, e.g. French"
                className="block w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 py-2.5 text-sm placeholder:text-ink-faint focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
              />
            </div>
            <SubmitButton size="sm" pendingLabel="Saving">
              Save subjects
            </SubmitButton>
          </ActionForm>
        </div>
      </details>
    </li>
  );
}

function ReadOnlyClasses({ schoolStructure }: { schoolStructure: Awaited<ReturnType<typeof getStructure>> }) {
  if (schoolStructure.length === 0) {
    return (
      <Card>
        <EmptyState icon={<BookOpen />} title="No classes set up yet">
          The school admin sets up classes and subjects.
        </EmptyState>
      </Card>
    );
  }
  return (
    <div className="space-y-6">
      {schoolStructure.map((section) => {
        const students = section.levels.reduce((n, l) => n + l.arms.reduce((m, a) => m + a.students, 0), 0);
        return (
          <Card key={section.id}>
            <CardHeader title={section.name} description={`${section.levels.length} classes, ${formatNumber(students)} students`} />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="bg-surface-sunk text-xs text-ink-muted">
                  <tr>
                    <th scope="col" className="w-36 px-6 py-3 font-bold">Class</th>
                    <th scope="col" className="w-48 px-4 py-3 font-bold">Arms and students</th>
                    <th scope="col" className="px-6 py-3 font-bold">Subjects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line align-top">
                  {section.levels.map((level) => (
                    <tr key={level.id}>
                      <th scope="row" className="px-6 py-4 font-bold text-ink">{level.name}</th>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {level.arms.map((arm) => (
                            <span key={arm.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-sunk px-2.5 py-1 text-xs">
                              <span className="font-bold">{arm.name}</span>
                              <span className="text-ink-muted tabular-nums">{arm.students}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-ink-muted">{level.subjects.length ? level.subjects.join(", ") : "No subjects assigned"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
