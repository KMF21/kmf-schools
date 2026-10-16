"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { cx } from "@kmf/ui";
import type { ActionState } from "@/lib/actions";
import { FormMessage } from "./form-bits";

type ServerAction = (prev: ActionState, form: FormData) => Promise<ActionState>;

/**
 * A small form wired to a server action, showing its own result.
 * `hidden` adds hidden fields (ids), `confirm` asks before submitting,
 * `resetOnSuccess` clears typed values after a successful save.
 */
export function ActionForm({
  action,
  hidden,
  confirm: confirmText,
  resetOnSuccess = false,
  quietSuccess = false,
  className,
  messageClassName,
  children,
}: {
  action: ServerAction;
  hidden?: Record<string, string>;
  confirm?: string;
  resetOnSuccess?: boolean;
  /** Hide the success message (for actions whose result is visible on the page). */
  quietSuccess?: boolean;
  className?: string;
  messageClassName?: string;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) form.current?.reset();
  }, [state, resetOnSuccess]);

  const shown = quietSuccess && state.ok ? {} : state;

  return (
    <form
      ref={form}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmText && !window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {hidden ? Object.entries(hidden).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />) : null}
      {children}
      <FormMessage state={shown} className={cx("mt-2 basis-full", messageClassName)} />
    </form>
  );
}
