"use client";

import { useActionState } from "react";
import { Field, Input, Select } from "@kmf/ui";
import { FieldError, FormMessage, SubmitButton } from "@/components/form-bits";
import type { ActionState } from "@/lib/actions";
import type { StudentDetail } from "@/lib/people";
import { saveStudent } from "./actions";

export function StudentForm({ student, arms, notice }: { student: StudentDetail | null; arms: Array<{ id: string; label: string }>; notice?: string }) {
  const [state, action] = useActionState<ActionState, FormData>(saveStudent, notice ? { ok: notice } : {});
  const guardian = student?.guardians[0] ?? null;

  const input = (name: string, label: string, value: string | null | undefined, props: React.ComponentProps<typeof Input> = {}, hint?: string) => (
    <Field label={label} htmlFor={name} hint={hint}>
      <Input
        id={name}
        name={name}
        defaultValue={value ?? ""}
        aria-invalid={Boolean(state.fields?.[name]) || undefined}
        aria-describedby={state.fields?.[name] ? `${name}-error` : hint ? `${name}-hint` : undefined}
        {...props}
      />
      <FieldError state={state} name={name} />
    </Field>
  );

  return (
    <form action={action} className="space-y-6 px-5 py-5 sm:px-6">
      {student ? <input type="hidden" name="id" value={student.id} /> : null}
      {guardian ? <input type="hidden" name="guardian_id" value={guardian.id} /> : null}
      <FormMessage state={state} />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {input("admission_no", "Admission number", student?.admissionNo, { required: true, maxLength: 40, autoCapitalize: "characters" })}
        {input("last_name", "Surname", student?.lastName, { required: true, maxLength: 60, autoComplete: "off" })}
        {input("first_name", "First name", student?.firstName, { required: true, maxLength: 60, autoComplete: "off" })}
        {input("middle_name", "Middle name", student?.middleName, { maxLength: 60, autoComplete: "off" })}
        <Field label="Gender" htmlFor="gender">
          <Select id="gender" name="gender" defaultValue={student?.gender ?? ""}>
            <option value="">Not recorded</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
          </Select>
        </Field>
        {input("date_of_birth", "Date of birth", student?.dateOfBirth, { type: "date" })}
        <Field label="Class" htmlFor="class_arm_id">
          <Select id="class_arm_id" name="class_arm_id" defaultValue={student?.classArmId ?? ""}>
            <option value="">Not in a class yet</option>
            {arms.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="status">
          <Select id="status" name="status" defaultValue={student?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="graduated">Graduated</option>
          </Select>
        </Field>
      </div>

      <fieldset className="space-y-4 border-t border-line pt-5">
        <legend className="text-base font-bold">Parent or guardian</legend>
        <p className="-mt-2 text-sm text-ink-muted">Brothers and sisters with the same parent phone number share one parent account.</p>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {input("guardian_name", "Name", guardian?.fullName, { maxLength: 100 })}
          {input("relationship", "Relationship", guardian?.relationship, { maxLength: 30, placeholder: "e.g. Mother" })}
          {input("guardian_phone", "Phone", guardian?.phone, { type: "tel", inputMode: "tel", maxLength: 30 })}
          {input("guardian_email", "Email", guardian?.email, { type: "email", inputMode: "email", maxLength: 120 })}
        </div>
      </fieldset>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving">{student ? "Save changes" : "Add student"}</SubmitButton>
      </div>
    </form>
  );
}
