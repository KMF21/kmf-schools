"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Field, Input, buttonClasses, cx } from "@kmf/ui";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { PRESETS } from "@/app/(portal)/settings/school-form";
import { createSchool, type AdminState } from "../../../actions";
import { LoginSlip } from "../login-slip";

/** "St. Mary's Nursery & Primary School, Jalingo" → "st-marys-nursery-primary-school-jalingo" */
function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function NewSchoolForm({ rootDomain }: { rootDomain: string }) {
  const [state, action] = useActionState<AdminState, FormData>(createSchool, {});
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [color, setColor] = useState("#1a8754");
  const shownSlug = slugEdited ? slug : toSlug(name);

  if (state.schoolId) {
    return (
      <div className="space-y-4 p-5 sm:p-6">
        <FormMessage state={state} />
        {state.login ? <LoginSlip login={state.login} /> : null}
        <div className="flex flex-wrap gap-2">
          <Link href={`/admin/schools/${state.schoolId}`} className={buttonClasses("solid", "md")}>
            Go to the school <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/admin" className={buttonClasses("outline", "md")}>
            All schools
          </Link>
        </div>
      </div>
    );
  }

  const err = (n: string) => state.fields?.[n];

  return (
    <form action={action} className="space-y-6 p-5 sm:p-6">
      <FormMessage state={state} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="School name" htmlFor="name" error={err("name")}>
            <Input id="name" name="name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Brightfield Academy, Jalingo" aria-invalid={Boolean(err("name")) || undefined} />
          </Field>
        </div>
        <Field label="Web name" htmlFor="slug" error={err("slug")} hint={`Portal address: ${shownSlug || "web-name"}.${rootDomain}`}>
          <Input
            id="slug"
            name="slug"
            required
            maxLength={63}
            autoCapitalize="none"
            spellCheck={false}
            value={shownSlug}
            onChange={(e) => {
              setSlugEdited(true);
              setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
            }}
            aria-invalid={Boolean(err("slug")) || undefined}
            aria-describedby={err("slug") ? "slug-error" : "slug-hint"}
          />
        </Field>
        <Field label="Short name" htmlFor="short_name" hint="Optional, e.g. BFA">
          <Input id="short_name" name="short_name" maxLength={40} aria-describedby="short_name-hint" />
        </Field>
        <Field label="School phone" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" inputMode="tel" maxLength={40} />
        </Field>
        <Field label="School email" htmlFor="email">
          <Input id="email" name="email" type="email" inputMode="email" maxLength={120} />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">Brand colour</legend>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.hex}
              type="button"
              onClick={() => setColor(p.hex)}
              aria-label={p.name}
              aria-pressed={color === p.hex}
              title={p.name}
              className={cx("size-9 rounded-full border-2 transition-transform", color === p.hex ? "scale-110 border-ink" : "border-surface hover:scale-105")}
              style={{ background: p.hex, boxShadow: "0 0 0 1px var(--line-strong)" }}
            />
          ))}
          <label className="ml-1 flex items-center gap-2 rounded-full border border-line-strong py-1 pr-3 pl-1 text-sm">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value.toLowerCase())} className="size-7 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="Choose any colour" />
            <span className="font-semibold tabular-nums">{color.toUpperCase()}</span>
          </label>
        </div>
        <input type="hidden" name="brand_color" value={color} />
      </fieldset>

      <fieldset className="space-y-4 rounded-[var(--radius-card)] border border-line p-4 sm:p-5">
        <legend className="px-1 text-sm font-bold">Proprietor&apos;s login (optional)</legend>
        <p className="text-sm text-ink-muted">They can then sign in, finish the setup and add school admins. You can also do this later.</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Proprietor's name" htmlFor="owner_name" error={err("owner_name")}>
            <Input id="owner_name" name="owner_name" maxLength={100} placeholder="e.g. Dr Hauwa Bello" aria-invalid={Boolean(err("owner_name")) || undefined} />
          </Field>
          <Field label="Email or phone" htmlFor="owner_contact" hint="Used to sign in.">
            <Input id="owner_contact" name="owner_contact" maxLength={120} autoCapitalize="none" spellCheck={false} aria-describedby="owner_contact-hint" />
          </Field>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Setting up">Set up school</SubmitButton>
      </div>
    </form>
  );
}
