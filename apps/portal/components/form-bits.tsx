"use client";

import { useFormStatus } from "react-dom";
import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import { Button, cx, type ButtonSize, type ButtonVariant } from "@kmf/ui";
import type { ActionState } from "@/lib/actions";

/** Submit button that shows progress while its form is saving. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "solid",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} disabled={pending} className={className}>
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** The result of the last save: a confirmation or a problem to fix. */
export function FormMessage({ state, className }: { state: ActionState; className?: string }) {
  if (state.error) {
    return (
      <p role="alert" className={cx("flex items-start gap-2 rounded-[var(--radius-control)] bg-bad-soft px-4 py-3 text-sm font-semibold text-bad", className)}>
        <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className={cx("flex items-start gap-2 rounded-[var(--radius-control)] bg-ok-soft px-4 py-3 text-sm font-semibold text-ok", className)}>
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        {state.ok}
      </p>
    );
  }
  return null;
}

/** Inline error under a single field. */
export function FieldError({ state, name }: { state: ActionState; name: string }) {
  const message = state.fields?.[name];
  if (!message) return null;
  return (
    <p id={`${name}-error`} className="text-sm font-semibold text-bad">
      {message}
    </p>
  );
}
