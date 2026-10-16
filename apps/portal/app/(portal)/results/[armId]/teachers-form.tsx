"use client";

import { useActionState } from "react";
import { Select } from "@kmf/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import type { ActionState } from "@/lib/actions";
import { saveClassTeachers } from "../actions";

type Option = { id: string; name: string };

export function TeachersForm({ armId, subjects, staff, formTeacherId, assigned }: { armId: string; subjects: Option[]; staff: Option[]; formTeacherId: string | null; assigned: Record<string, string> }) {
  const [state, action] = useActionState<ActionState, FormData>(saveClassTeachers, {});
  const options = (
    <>
      <option value="">Not assigned</option>
      {staff.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </>
  );
  return (
    <form action={action} className="space-y-4 p-5 sm:p-6">
      <input type="hidden" name="arm_id" value={armId} />
      <label className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-center">
        <span className="text-sm font-bold">Form teacher</span>
        <Select name="form_teacher" defaultValue={formTeacherId ?? ""}>
          {options}
        </Select>
      </label>
      <div className="grid gap-3 border-t border-line pt-4">
        {subjects.map((s) => (
          <label key={s.id} className="grid gap-1.5 sm:grid-cols-[14rem_1fr] sm:items-center">
            <span className="text-sm font-semibold">{s.name}</span>
            <Select name={`subject:${s.id}`} defaultValue={assigned[s.id] ?? ""}>
              {options}
            </Select>
          </label>
        ))}
      </div>
      <FormMessage state={state} />
      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving">Save teachers</SubmitButton>
      </div>
    </form>
  );
}
