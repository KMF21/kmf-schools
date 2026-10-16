"use client";

import { useActionState, useRef, useState } from "react";
import { ImageUp } from "lucide-react";
import type { School } from "@kmf/core";
import { buttonClasses } from "@kmf/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { SchoolMark } from "@/components/school-mark";
import type { ActionState } from "@/lib/actions";
import { removeLogo, uploadLogo } from "./actions";

export function LogoForm({ school }: { school: School }) {
  const [uploadState, upload] = useActionState<ActionState, FormData>(uploadLogo, {});
  const [removeState, remove] = useActionState<ActionState>(removeLogo, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const shown: School = preview ? { ...school, logoUrl: preview } : school;
  const state = removeState.ok || removeState.error ? removeState : uploadState;

  return (
    <div className="space-y-4 px-5 py-5 sm:px-6">
      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-4">
        <SchoolMark school={shown} size={72} />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{preview ? "New logo, not saved yet" : school.logoUrl ? "Current logo" : "No logo yet"}</p>
          <p className="text-sm text-ink-muted">PNG, JPG or WebP, up to 2 MB. A square logo with a plain background looks best.</p>
        </div>
      </div>

      <form action={upload} className="flex flex-wrap items-center gap-2">
        <label className={buttonClasses("outline", "sm", "cursor-pointer")}>
          <ImageUp className="size-4" aria-hidden />
          Choose image
          <input
            ref={input}
            type="file"
            name="logo"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setTooBig(Boolean(file && file.size > 2 * 1024 * 1024));
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
        </label>
        {preview && !tooBig ? <SubmitButton size="sm" pendingLabel="Uploading">Save logo</SubmitButton> : null}
        {tooBig ? <span className="text-sm font-semibold text-bad">That image is larger than 2 MB. Choose a smaller one.</span> : null}
      </form>

      {school.logoUrl && !preview ? (
        <form action={remove}>
          <SubmitButton variant="ghost" size="sm" pendingLabel="Removing">Remove logo</SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
