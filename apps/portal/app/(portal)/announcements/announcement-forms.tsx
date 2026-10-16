"use client";

import { useActionState, useEffect, useRef } from "react";
import { Trash2 } from "lucide-react";
import { Field, Input, Select } from "@kmf/ui";
import { FieldError, FormMessage, SubmitButton } from "@/components/form-bits";
import type { ActionState } from "@/lib/actions";
import { deleteAnnouncement, postAnnouncement } from "./actions";

export function NewAnnouncementForm() {
  const [state, action] = useActionState<ActionState, FormData>(postAnnouncement, {});
  const form = useRef<HTMLFormElement>(null);

  // Clear the form after a successful post, ready for the next one.
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="space-y-4 px-5 py-5 sm:px-6">
      <FormMessage state={state} />
      <Field label="Title" htmlFor="title">
        <Input id="title" name="title" maxLength={120} required aria-invalid={Boolean(state.fields?.title) || undefined} placeholder="e.g. Second term resumption" />
        <FieldError state={state} name="title" />
      </Field>
      <Field label="Announcement" htmlFor="body">
        <textarea
          id="body"
          name="body"
          rows={4}
          maxLength={4000}
          required
          aria-invalid={Boolean(state.fields?.body) || undefined}
          className="block w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 py-3 text-ink placeholder:text-ink-faint focus:border-brand focus:ring-4 focus:ring-brand-soft focus:outline-none"
          placeholder="What do people need to know?"
        />
        <FieldError state={state} name="body" />
      </Field>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <Field label="Who should see it" htmlFor="audience">
            <Select id="audience" name="audience" defaultValue="everyone">
              <option value="everyone">Everyone in the portal</option>
              <option value="staff">Staff only</option>
              <option value="parents">Parents only</option>
              <option value="public">Everyone, and on the school website</option>
            </Select>
          </Field>
        </div>
        <SubmitButton pendingLabel="Posting" size="lg">Post announcement</SubmitButton>
      </div>
    </form>
  );
}

export function DeleteAnnouncementButton({ id, title }: { id: string; title: string }) {
  const [state, action] = useActionState<ActionState, FormData>(deleteAnnouncement, {});
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`Remove "${title}"? Nobody will see it after this.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <SubmitButton variant="ghost" size="sm" pendingLabel="Removing">
        <Trash2 className="size-4" aria-hidden /> Remove
      </SubmitButton>
      {state.error ? <p className="mt-1 text-xs font-semibold text-bad">{state.error}</p> : null}
    </form>
  );
}
