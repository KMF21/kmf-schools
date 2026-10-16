"use client";

import { useActionState, useEffect, useRef } from "react";
import { Field, Input, describedById } from "@kmf/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import type { ActionState } from "@/lib/actions";
import { changeOwnPassword } from "./actions";

export function PasswordForm() {
  const [state, action] = useActionState<ActionState, FormData>(changeOwnPassword, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="space-y-4 p-5 sm:p-6" noValidate>
      <FormMessage state={state} />
      <Field label="New password" htmlFor="password" error={state.fields?.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required aria-invalid={Boolean(state.fields?.password) || undefined} aria-describedby={describedById("password", state.fields?.password)} />
      </Field>
      <Field label="Type it again" htmlFor="confirm" error={state.fields?.confirm}>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required aria-invalid={Boolean(state.fields?.confirm) || undefined} aria-describedby={describedById("confirm", state.fields?.confirm)} />
      </Field>
      <SubmitButton pendingLabel="Saving">Change password</SubmitButton>
    </form>
  );
}
