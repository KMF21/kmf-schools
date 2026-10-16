"use client";

import { useActionState } from "react";
import { KeyRound, LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { FormMessage } from "@/components/form-bits";
import { resetManagerPassword, type AdminState } from "../../../actions";
import { LoginSlip } from "../login-slip";

function ResetButton({ name }: { name: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="grid size-8 place-items-center rounded-full text-ink-muted hover:bg-surface-sunk hover:text-ink disabled:opacity-60"
      aria-label={`Reset password for ${name}`}
      title="Reset password"
    >
      {pending ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <KeyRound className="size-4" aria-hidden />}
    </button>
  );
}

/** Reset button for one proprietor or admin; the new password appears below the row. */
export function ResetManager({ schoolId, userId, name, children }: { schoolId: string; userId: string; name: string; children: React.ReactNode }) {
  const [state, action] = useActionState<AdminState, FormData>(resetManagerPassword, {});
  return (
    <li className="py-2.5 first:pt-0">
      <form
        action={action}
        className="flex items-center gap-3"
        onSubmit={(e) => {
          if (!window.confirm(`Give ${name} a new password? Their old password will stop working.`)) e.preventDefault();
        }}
      >
        <input type="hidden" name="school_id" value={schoolId} />
        <input type="hidden" name="user_id" value={userId} />
        {children}
        <ResetButton name={name} />
      </form>
      {state.error ? <FormMessage state={state} className="mt-2" /> : null}
      {state.login ? <div className="mt-2"><LoginSlip login={state.login} /></div> : null}
    </li>
  );
}
