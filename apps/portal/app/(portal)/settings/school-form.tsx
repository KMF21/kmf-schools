"use client";

import { useActionState, useState } from "react";
import { brandPalette, type School } from "@kmf/core";
import { Field, Input, cx } from "@kmf/ui";
import { FieldError, FormMessage, SubmitButton } from "@/components/form-bits";
import type { ActionState } from "@/lib/actions";
import { saveSchoolDetails } from "./actions";

const PRESETS = [
  { hex: "#1a8754", name: "Green" },
  { hex: "#1d4ed8", name: "Royal blue" },
  { hex: "#0f2c5c", name: "Navy" },
  { hex: "#7a1f2b", name: "Maroon" },
  { hex: "#6d28d9", name: "Purple" },
  { hex: "#b45309", name: "Amber" },
  { hex: "#0e7490", name: "Teal" },
  { hex: "#be123c", name: "Red" },
];

export function SchoolForm({ school }: { school: School }) {
  const [state, action] = useActionState<ActionState, FormData>(saveSchoolDetails, {});
  const [color, setColor] = useState(school.brandColor);
  const palette = brandPalette(color);
  const adjusted = palette.solid !== palette.base;

  const field = (name: keyof typeof labels, value: string | null, props: React.ComponentProps<typeof Input> = {}) => (
    <Field label={labels[name]} htmlFor={name} hint={hints[name]}>
      <Input
        id={name}
        name={name}
        defaultValue={value ?? ""}
        aria-invalid={Boolean(state.fields?.[name]) || undefined}
        aria-describedby={state.fields?.[name] ? `${name}-error` : hints[name] ? `${name}-hint` : undefined}
        {...props}
      />
      <FieldError state={state} name={name} />
    </Field>
  );

  return (
    <form action={action} className="space-y-5 px-5 py-5 sm:px-6">
      <FormMessage state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">{field("name", school.name, { required: true, maxLength: 120 })}</div>
        {field("short_name", school.shortName, { maxLength: 40 })}
        {field("motto", school.motto, { maxLength: 120 })}
        <div className="sm:col-span-2">{field("address", school.address, { maxLength: 200 })}</div>
        {field("phone", school.phone, { type: "tel", inputMode: "tel", maxLength: 40 })}
        {field("email", school.email, { type: "email", inputMode: "email", maxLength: 120 })}
      </div>

      <fieldset className="space-y-3">
        <legend className="text-sm font-bold text-ink">Brand colour</legend>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.hex}
              type="button"
              onClick={() => setColor(p.hex)}
              aria-label={p.name}
              aria-pressed={color.toLowerCase() === p.hex}
              title={p.name}
              className={cx(
                "size-9 rounded-full border-2 transition-transform",
                color.toLowerCase() === p.hex ? "scale-110 border-ink" : "border-surface hover:scale-105",
              )}
              style={{ background: p.hex, boxShadow: "0 0 0 1px var(--line-strong)" }}
            />
          ))}
          <label className="ml-1 flex items-center gap-2 rounded-full border border-line-strong py-1 pr-3 pl-1 text-sm">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0"
              aria-label="Choose any colour"
            />
            <span className="font-semibold tabular-nums">{color.toUpperCase()}</span>
          </label>
        </div>
        <input type="hidden" name="brand_color" value={color} />
        <FieldError state={state} name="brand_color" />

        {/* Preview with the adjusted shades, exactly as the portal will use them */}
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-control)] border border-line bg-surface-sunk p-3">
          <span className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: palette.solid }}>
            Button
          </span>
          <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: palette.soft, color: palette.strong }}>
            Badge
          </span>
          <span className="text-sm font-bold" style={{ color: palette.strong }}>
            Link text
          </span>
          <span className="text-sm text-ink-muted">
            {adjusted ? "Darkened slightly on buttons so white text stays readable." : "Readable as chosen."}
          </span>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Saving">Save details</SubmitButton>
      </div>
    </form>
  );
}

const labels = {
  name: "School name",
  short_name: "Short name",
  motto: "Motto",
  address: "Address",
  phone: "Phone",
  email: "Email",
} as const;

const hints: Partial<Record<keyof typeof labels, string>> = {
  short_name: "Used where space is tight, such as the phone menu.",
  motto: "Shown on the login page and report cards.",
};
