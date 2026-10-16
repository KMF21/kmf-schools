"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button, Field, Input, describedById } from "@kmf/ui";
import { signIn, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signIn, {});
  const [showPassword, setShowPassword] = useState(false);
  const error = state.error;

  return (
    <form action={action} className="space-y-4" noValidate>
      {error ? (
        <p role="alert" className="rounded-[var(--radius-control)] border border-bad/25 bg-bad-soft px-4 py-3 text-sm font-semibold text-bad">
          {error}
        </p>
      ) : null}

      <Field label="Email or admission number" htmlFor="identifier" hint="Staff: email. Students and parents: number on the login slip.">
        <Input
          id="identifier"
          name="identifier"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={state.identifier}
          aria-describedby={describedById("identifier", undefined, true)}
          aria-invalid={Boolean(error) || undefined}
          placeholder="e.g. BFA/2026/014"
        />
      </Field>

      <Field label="Password" htmlFor="password">
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            aria-invalid={Boolean(error) || undefined}
            className="pr-12"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-1.5 my-auto grid size-9 place-items-center rounded-full text-ink-muted hover:bg-surface-sunk hover:text-ink"
          >
            {showPassword ? <EyeOff className="size-[1.125rem]" aria-hidden /> : <Eye className="size-[1.125rem]" aria-hidden />}
          </button>
        </div>
      </Field>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : null}
        {pending ? "Signing in" : "Sign in"}
      </Button>

      <p className="text-center text-[0.8125rem] text-ink-muted">Forgot your password? Ask the school office to reset it.</p>
    </form>
  );
}
