"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, Input, Select } from "@kmf/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { addManager, type AdminState } from "../../../actions";
import { LoginSlip } from "../login-slip";

export function ManagerForm({ schoolId }: { schoolId: string }) {
  const [state, action] = useActionState<AdminState, FormData>(addManager, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="space-y-4">
      <input type="hidden" name="school_id" value={schoolId} />
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_11rem]">
        <Field label="Name" htmlFor="m-name" error={state.fields?.name}>
          <Input id="m-name" name="name" maxLength={100} required />
        </Field>
        <Field label="Email or phone" htmlFor="m-contact" error={state.fields?.contact}>
          <Input id="m-contact" name="contact" maxLength={120} autoCapitalize="none" spellCheck={false} required />
        </Field>
        <Field label="Role" htmlFor="m-role">
          <Select id="m-role" name="role" defaultValue="owner">
            <option value="owner">Proprietor</option>
            <option value="admin">School admin</option>
          </Select>
        </Field>
      </div>
      <SubmitButton variant="outline" pendingLabel="Creating login">
        Give a login
      </SubmitButton>
      <FormMessage state={state} />
      {state.login ? <LoginSlip login={state.login} /> : null}
    </form>
  );
}
