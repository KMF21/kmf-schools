"use client";

import { useActionState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button, Field, Input } from "@kmf/ui";
import { signInAdmin, type SignInState } from "../actions";

export function AdminLoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAdmin, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error ? (
        <p role="alert" className="rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">
          {state.error}
        </p>
      ) : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required defaultValue={state.email} aria-invalid={Boolean(state.error) || undefined} />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required aria-invalid={Boolean(state.error) || undefined} />
      </Field>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : null}
        {pending ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}
