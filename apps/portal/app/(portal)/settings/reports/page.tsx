import type { Metadata } from "next";
import { Trash2 } from "lucide-react";
import { Card, CardHeader, Field, Input, Select } from "@kmf/ui";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/form-bits";
import { getReportSettings, getTraits } from "@/lib/results";
import { requireViewer } from "@/lib/session";
import { addTrait, deleteTrait, renameTrait, saveReportSettings } from "./actions";
import { StampForm } from "./stamp-form";

export const metadata: Metadata = { title: "Report card settings" };

const HEAD_TITLES = ["Principal", "Head teacher", "Headmistress", "Headmaster", "Proprietor", "Proprietress", "Director"];

export default async function ReportSettingsPage() {
  const { school } = await requireViewer(["owner", "admin"]);
  const [settings, traits] = await Promise.all([getReportSettings(school), getTraits(school)]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Report cards" description="How report cards look for every class." />
        <ActionForm action={saveReportSettings} className="space-y-5 px-5 py-5 sm:px-6">
          <label className="flex items-start gap-3 rounded-[var(--radius-control)] border border-line p-4">
            <input type="checkbox" name="show_position" defaultChecked={settings.showPosition} className="mt-1 size-5 accent-[var(--brand)]" />
            <span>
              <span className="block font-bold">Show positions</span>
              <span className="block text-sm text-ink-muted">Each student&apos;s position in class and in each subject, like 3rd of 28. Turn off if your school doesn&apos;t rank pupils.</span>
            </span>
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Title of the head" htmlFor="head_title" hint="Used for the head's comment and signature.">
              <Select id="head_title" name="head_title" defaultValue={HEAD_TITLES.includes(settings.headTitle) ? settings.headTitle : "Head teacher"}>
                {HEAD_TITLES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            </Field>
            <Field label="Name of the head" htmlFor="head_name" hint="Optional. Printed under the head's comment.">
              <Input id="head_name" name="head_name" defaultValue={settings.headName ?? ""} maxLength={80} placeholder="e.g. Dr Hauwa Bello" />
            </Field>
          </div>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Saving">Save</SubmitButton>
          </div>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader title="School stamp" description="Printed beside the head's comment. A photo or scan of the stamp on white paper works well." />
        <StampForm stampUrl={settings.stampUrl} />
      </Card>

      <Card>
        <CardHeader title="Behaviour and skills" description="Form teachers rate each student from 1 (poor) to 5 (excellent) on these. Add, rename or remove to match your school's report card." />
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-2">
          {(["behaviour", "skill"] as const).map((kind) => (
            <section key={kind}>
              <h3 className="mb-2 text-sm font-bold">{kind === "behaviour" ? "Behaviour" : "Skills"}</h3>
              <ul className="space-y-2">
                {traits
                  .filter((t) => t.kind === kind)
                  .map((t) => (
                    <li key={t.id} className="flex items-center gap-2">
                      <ActionForm action={renameTrait} hidden={{ id: t.id }} quietSuccess className="flex min-w-0 flex-1 items-center gap-2" messageClassName="hidden">
                        <Input name="name" defaultValue={t.name} maxLength={60} aria-label={`Rename ${t.name}`} className="h-10 text-sm" />
                        <SubmitButton variant="ghost" size="sm" pendingLabel="Saving">
                          Save
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm action={deleteTrait} hidden={{ id: t.id }} confirm={`Remove ${t.name}? It will no longer appear on report cards.`} messageClassName="hidden">
                        <button type="submit" className="grid size-9 place-items-center rounded-full text-ink-muted hover:bg-bad-soft hover:text-bad" aria-label={`Remove ${t.name}`} title="Remove">
                          <Trash2 className="size-4" aria-hidden />
                        </button>
                      </ActionForm>
                    </li>
                  ))}
              </ul>
              <ActionForm action={addTrait} hidden={{ kind }} resetOnSuccess className="mt-3 flex items-center gap-2">
                <Input name="name" maxLength={60} placeholder={kind === "behaviour" ? "e.g. Leadership" : "e.g. Computer skills"} aria-label={`New ${kind}`} className="h-10 text-sm" />
                <SubmitButton variant="outline" size="sm" pendingLabel="Adding">
                  Add
                </SubmitButton>
              </ActionForm>
            </section>
          ))}
        </div>
      </Card>
    </div>
  );
}
