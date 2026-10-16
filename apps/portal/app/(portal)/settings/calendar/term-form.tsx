"use client";

import { useActionState } from "react";
import { Field, Input, Select } from "@kmf/ui";
import { FieldError, FormMessage, SubmitButton } from "@/components/form-bits";
import type { ActionState } from "@/lib/actions";
import type { CurrentTerm } from "@/lib/data";
import { saveCurrentTerm } from "./actions";

export function TermForm({ term }: { term: CurrentTerm }) {
  const [state, action] = useActionState<ActionState, FormData>(saveCurrentTerm, {});
  const invalid = (name: string) => Boolean(state.fields?.[name]) || undefined;

  return (
    <form action={action} className="space-y-5 px-5 py-5 sm:px-6">
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Session" htmlFor="session" hint="For example 2026/2027.">
          <Input id="session" name="session" defaultValue={term?.session ?? ""} placeholder="2026/2027" inputMode="numeric" maxLength={9} required aria-invalid={invalid("session")} />
          <FieldError state={state} name="session" />
        </Field>
        <Field label="Term" htmlFor="term">
          <Select id="term" name="term" defaultValue={String(term?.number ?? 1)}>
            <option value="1">First term</option>
            <option value="2">Second term</option>
            <option value="3">Third term</option>
          </Select>
        </Field>
        <Field label="Term starts" htmlFor="starts">
          <Input id="starts" name="starts" type="date" defaultValue={term?.startsOn ?? ""} aria-invalid={invalid("starts")} />
          <FieldError state={state} name="starts" />
        </Field>
        <Field label="Term ends" htmlFor="ends">
          <Input id="ends" name="ends" type="date" defaultValue={term?.endsOn ?? ""} aria-invalid={invalid("ends")} />
          <FieldError state={state} name="ends" />
        </Field>
        <Field label="Next term begins" htmlFor="next" hint="Printed on report cards as the resumption date.">
          <Input id="next" name="next" type="date" defaultValue={term?.nextTermBegins ?? ""} aria-invalid={invalid("next")} />
          <FieldError state={state} name="next" />
        </Field>
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving">Save and make current</SubmitButton>
      </div>
    </form>
  );
}
