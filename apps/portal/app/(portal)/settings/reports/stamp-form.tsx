"use client";

import { useActionState, useState } from "react";
import { ImageUp } from "lucide-react";
import { buttonClasses } from "@kmf/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import type { ActionState } from "@/lib/actions";
import { removeStamp, uploadStamp } from "./actions";

export function StampForm({ stampUrl }: { stampUrl: string | null }) {
  const [uploadState, upload] = useActionState<ActionState, FormData>(uploadStamp, {});
  const [removeState, remove] = useActionState<ActionState>(removeStamp, {});
  const [preview, setPreview] = useState<string | null>(null);
  const [tooBig, setTooBig] = useState(false);
  const state = removeState.ok || removeState.error ? removeState : uploadState;
  const shown = preview ?? stampUrl;

  return (
    <div className="space-y-4 px-5 py-5 sm:px-6">
      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-4">
        <span className="grid size-24 place-items-center overflow-hidden rounded-[var(--radius-control)] border border-dashed border-line-strong bg-white">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="School stamp" className="size-full object-contain" />
          ) : (
            <span className="text-xs text-ink-faint">No stamp</span>
          )}
        </span>
        <p className="min-w-0 flex-1 text-sm text-ink-muted">PNG, JPG or WebP, up to 1 MB.</p>
      </div>
      <form action={upload} className="flex flex-wrap items-center gap-2">
        <label className={buttonClasses("outline", "sm", "cursor-pointer")}>
          <ImageUp className="size-4" aria-hidden />
          Choose image
          <input
            type="file"
            name="stamp"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              setTooBig(Boolean(file && file.size > 1024 * 1024));
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
        </label>
        {preview && !tooBig ? (
          <SubmitButton size="sm" pendingLabel="Uploading">
            Save stamp
          </SubmitButton>
        ) : null}
        {tooBig ? <span className="text-sm font-semibold text-bad">That image is larger than 1 MB.</span> : null}
      </form>
      {stampUrl && !preview ? (
        <form action={remove}>
          <SubmitButton variant="ghost" size="sm" pendingLabel="Removing">
            Remove stamp
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
