"use client";

import { useActionState } from "react";
import { Field, Input, Select } from "@kmf/ui";
import { FieldError, FormMessage, SubmitButton } from "@/components/form-bits";
import type { ActionState } from "@/lib/actions";
import type { StaffRow } from "@/lib/people";
import { saveStaff } from "./actions";

export function StaffForm({ member, notice }: { member: StaffRow | null; notice?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(saveStaff, notice ? { ok: notice } : {});

  const input = (name: string, label: string, value: string | null | undefined, props: React.ComponentProps<typeof Input> = {}, hint?: string) => (
    <Field label={label} htmlFor={name} hint={hint}>
      <Input id={name} name={name} defaultValue={value ?? ""} aria-invalid={Boolean(state.fields?.[name]) || undefined} {...props} />
      <FieldError state={state} name={name} />
    </Field>
  );

  return (
    <form action={action} className="space-y-6 px-5 py-5 sm:px-6">
      {member ? <input type="hidden" name="id" value={member.id} /> : null}
      <FormMessage state={state} />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {input("title", "Title", member?.title, { maxLength: 20, placeholder: "e.g. Mrs" })}
        {input("last_name", "Surname", member?.lastName, { required: true, maxLength: 60, autoComplete: "off" })}
        {input("first_name", "First name", member?.firstName, { required: true, maxLength: 60, autoComplete: "off" })}
        {input("email", "Email", member?.email, { type: "email", inputMode: "email", maxLength: 120 }, "Used to sign in to the portal.")}
        {input("phone", "Phone", member?.phone, { type: "tel", inputMode: "tel", maxLength: 30 })}
        {input("position", "Position", member?.position, { maxLength: 80, placeholder: "e.g. Mathematics teacher" })}
        {member ? (
          <Field label="Status" htmlFor="is_active">
            <Select id="is_active" name="is_active" defaultValue={member.isActive ? "true" : "false"}>
              <option value="true">Working at the school</option>
              <option value="false">Left the school</option>
            </Select>
          </Field>
        ) : null}
      </div>
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving">{member ? "Save changes" : "Add staff member"}</SubmitButton>
      </div>
    </form>
  );
}
