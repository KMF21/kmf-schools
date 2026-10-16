import type { ComponentPropsWithoutRef, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Buttons */

export type ButtonVariant = "solid" | "outline" | "soft" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-[background-color,box-shadow,color,border-color] duration-150 disabled:opacity-55 disabled:pointer-events-none select-none";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  solid: "bg-brand text-brand-on hover:bg-brand-hover shadow-[var(--shadow-brand)]",
  outline: "border border-brand-line text-brand-text bg-surface hover:bg-brand-wash hover:border-brand",
  soft: "bg-brand-soft text-brand-text hover:bg-brand-line/60",
  ghost: "text-ink-muted hover:text-ink hover:bg-surface-sunk",
  danger: "bg-bad text-white hover:opacity-90",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-12 px-7 text-base",
};

/** Class names for anything that should look like a button (links included). */
export function buttonClasses(variant: ButtonVariant = "solid", size: ButtonSize = "md", extra?: string): string {
  return cx(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size], extra);
}

export function Button({
  variant = "solid",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

/* -------------------------------------------------------------------- Cards */

export function Card({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cx("rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-card)]", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cx("flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6", className)}>
      <div className="min-w-0">
        <h2 className="text-[1.0625rem]">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}

/* ------------------------------------------------------- Tags and statuses */

export type Tone = "brand" | "neutral" | "ok" | "warn" | "bad" | "info";

const TONES: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-text",
  neutral: "bg-surface-sunk text-ink-muted border border-line",
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
};

/** Small rounded status label, e.g. Published, Owing. */
export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", TONES[tone], className)}>
      {children}
    </span>
  );
}

/** Academica-style pill tag that sits above a heading to give it context. Use sparingly. */
export function Eyebrow({ icon, children, className }: { icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full bg-brand-soft px-3.5 py-1.5 text-[0.6875rem] font-extrabold uppercase tracking-[0.12em] text-brand-text",
        className,
      )}
    >
      {icon ? <span aria-hidden className="[&>svg]:size-3.5">{icon}</span> : null}
      {children}
    </span>
  );
}

/** Rounded square that holds an icon, tinted with the brand colour. */
export function IconTile({ children, tone = "brand", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return (
    <span
      aria-hidden
      className={cx("grid size-11 shrink-0 place-items-center rounded-[0.875rem] [&>svg]:size-5", TONES[tone], className)}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- Stat tile */

export function StatTile({
  label,
  value,
  note,
  icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.1em] text-ink-faint">{label}</p>
        <p className="mt-1.5 font-[family-name:var(--font-display)] text-[1.75rem] leading-none font-bold text-ink tabular-nums">
          {value}
        </p>
        {note ? <p className="mt-2 text-xs text-ink-muted">{note}</p> : null}
      </div>
      {icon ? <IconTile tone={tone}>{icon}</IconTile> : null}
    </div>
  );
}

/* ------------------------------------------------------------------- Forms */

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  // Inputs should set aria-describedby={describedById(htmlFor, error, hint)} so the hint or error is read aloud.
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-bold text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="text-sm font-semibold text-bad">
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-ink-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function describedById(htmlFor: string, error?: string, hint?: ReactNode): string | undefined {
  return error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;
}

const INPUT =
  "block w-full rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 text-ink placeholder:text-ink-faint transition-[border-color,box-shadow] focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand-soft aria-[invalid=true]:border-bad";

export function Input({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={cx(INPUT, "h-12", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentPropsWithoutRef<"select">) {
  return <select className={cx(INPUT, "h-12 pr-10", className)} {...props} />;
}

/* ------------------------------------------------------------------ People */

export function initials(name: string): string {
  const parts = name.replace(/^(mr|mrs|ms|miss|dr|prof)\.?\s+/i, "").trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.36)) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} style={style} className={cx("rounded-full object-cover ring-2 ring-surface", className)} />;
  }
  return (
    <span
      aria-hidden
      style={style}
      className={cx("grid shrink-0 place-items-center rounded-full bg-brand-soft font-bold text-brand-text ring-2 ring-surface", className)}
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------ Empty state */

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      {icon ? <IconTile>{icon}</IconTile> : null}
      <h3 className="text-base">{title}</h3>
      {children ? <p className="max-w-sm text-sm text-ink-muted">{children}</p> : null}
      {action}
    </div>
  );
}
